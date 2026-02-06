import logging
from typing import List, Union, Optional, Dict, Any, Tuple
from collections import defaultdict

from elasticsearch.exceptions import NotFoundError
from elasticsearch.helpers import bulk

from app.core.elastic import es_client
from app.core.model_registry import model_registry
from app.models_db import Concept, Cluster

logger = logging.getLogger(__name__)

# ================================================
# Concept indexer in elasticsearch
# ================================================


class ConceptIndexer:
    """Manages indexing and searching of concept embeddings in Elasticsearch.

    This class handles the creation and management of Elasticsearch indices for
    storing medical concepts with their embeddings, and provides methods for
    semantic search and term-to-concept mapping.
    """

    def __init__(self):
        """Initialize the ConceptIndexer with lazy-loaded model and embedding dimension."""
        self._model = None
        self._embedding_dim = None

    @property
    def model(self):
        """Get the embedding model from the model registry.

        Returns:
            The embedding model instance used for generating embeddings.
        """
        if self._model is None:
            self._model = model_registry.get_model("embedding_sentence")
        return self._model

    @property
    def embedding_dim(self):
        """Get the dimension of the sentence embeddings.

        Returns:
            The dimensionality of the embedding vectors.
        """
        if self._embedding_dim is None:
            test_emb = self._calculate_embedding("test")
            self._embedding_dim = len(test_emb)
        return self._embedding_dim

    def create_concept_index(self, vocab_id: int):
        """Create an Elasticsearch index for storing concepts from a vocabulary.

        Args:
            vocab_id: The vocabulary ID to create an index for.
        """
        index_name = f"concepts_{vocab_id}"
        if not es_client.indices.exists(index=index_name):
            mapping = {
                "mappings": {
                    "properties": {
                        "vocab_term_id": {"type": "keyword"},
                        "vocab_term_name": {"type": "text"},
                        "domain_id": {"type": "keyword"},
                        "concept_class_id": {"type": "keyword"},
                        "standard_concept": {"type": "keyword"},
                        "embedding": {
                            "type": "dense_vector",
                            "dims": self.embedding_dim,
                            "index": True,
                            "element_type": "float",
                            "index_options": {
                                "type": "int8_hnsw",  # compress it to 1-byte integers
                            }
                        }
                    }
                }
            }
            es_client.indices.create(index=index_name, body=mapping)
            logger.info(f"Created index '{index_name}' successfully")
        else:
            logger.info(f"Index '{index_name}' already exists, skipping creation")

    def delete_index(self, vocab_id: int):
        """Delete an Elasticsearch index for a vocabulary.

        Args:
            vocab_id: The vocabulary ID whose index should be deleted.
        """
        index_name = f"concepts_{vocab_id}"

        if es_client.indices.exists(index=index_name):
            es_client.indices.delete(index=index_name)
            logger.info(f"Index {index_name} deleted successfully")
        else:
            logger.info(f"Index {index_name} not found, skipping deletion")

    def _calculate_embedding(self, text: Union[str, List[str]]) -> List[float]:
        """Calculate embedding vector(s) for the given text.

        Args:
            text: A single text string or a list of text strings to embed.

        Returns:
            A list containing the embedding vector(s).
        """
        return self.model.embed(text)

    def _group_concepts_by_vocab(
        self, concepts: List[Concept]
    ) -> defaultdict[int, List[Concept]]:
        grouped = defaultdict(list)
        for c in concepts:
            grouped[c.vocabulary_id].append(c)
        return grouped

    def add_bulk_to_index(self, concepts: List[Concept], embed_batch_size: int = 512):
        grouped_concepts = self._group_concepts_by_vocab(concepts)

        for vocab_id, concepts in grouped_concepts.items():
            index_name = f"concepts_{vocab_id}"

            for i in range(0, len(concepts), embed_batch_size):
                embed_batch = concepts[i : i + embed_batch_size]

                texts = [c.vocab_term_name for c in embed_batch]
                embeddings = self._calculate_embedding(texts)

                actions = []
                for c, emb in zip(embed_batch, embeddings):
                    actions.append(
                        {
                            "_index": index_name,
                            "_id": c.id,
                            "_source": {
                                "vocab_term_id": c.vocab_term_id,
                                "vocab_term_name": c.vocab_term_name,
                                "domain_id": c.domain_id,
                                "concept_class_id": c.concept_class_id,
                                "standard_concept": c.standard_concept,
                                "embedding": emb,
                            },
                        }
                    )

                _, errors = bulk(
                    es_client,
                    actions,
                    raise_on_error=False,
                    raise_on_exception=False,
                )

                if errors:
                    logger.error(f"ES bulk failed for batch starting at {i}")
                    logger.error(f"Failed docs: {len(errors)}")

                    for err in errors[:3]:
                        logger.error(f"ES error: {err}")

                    raise RuntimeError(
                        f"{len(errors)} document(s) failed to index into Elasticsearch"
                    )

    def add_concept_to_index(self, vocab_id: int, concept_db: Concept):
        """Add a single concept to the index.

        Args:
            vocab_id: The vocabulary ID for the target index.
            concept_db: The Concept object to add to the index.
        """
        # create embedding vector + add to index
        concept_text = concept_db.vocab_term_name
        vect_embedding = self._calculate_embedding(concept_text)

        doc = {
            "vocab_term_id": concept_db.vocab_term_id,
            "vocab_term_name": concept_text,
            "domain_id": concept_db.domain_id,
            "concept_class_id": concept_db.concept_class_id,
            "standard_concept": concept_db.standard_concept,
            "embedding": vect_embedding,
        }

        es_client.index(index=f"concepts_{vocab_id}", id=concept_db.id, document=doc)

    def set_index_refresh(self, vocab_id: int, interval: str):
        """Set the refresh interval for a vocabulary's ES index.

        Args:
            vocab_id: The vocabulary ID whose index settings to update.
            interval: The refresh interval (e.g. "1s", "-1" to disable).
        """
        index_name = f"concepts_{vocab_id}"
        if es_client.indices.exists(index=index_name):
            es_client.indices.put_settings(
                index=index_name,
                body={"index": {"refresh_interval": interval}},
            )

    def delete_concept_from_index(self, vocab_id: int, concept_id: int):
        """Delete a concept from the index.

        Args:
            vocab_id: The vocabulary ID for the target index.
            concept_id: The ID of the concept to delete.
        """
        index_name = f"concepts_{vocab_id}"

        try:
            es_client.delete(index=index_name, id=concept_id)
            logger.info(f"Document {concept_id} deleted from {index_name} successfully")
        except NotFoundError:
            logger.info(f"Document {concept_id} not found in {index_name}, skipping deletion")

    def es_map_term_to_concept(
        self, cluster_db: Cluster, vocab_ids: List[int]
    ) -> List[int]:
        """Map a source term to relevant concepts using semantic search.

        Performs embedding-based similarity search to find the most relevant
        concepts across specified vocabularies for a given source term.

        Args:
            cluster_db: The cluster to map to concepts.
            vocab_ids: List of vocabulary IDs to search across.

        Returns:
            A list of concept IDs ordered by relevance (most relevant first).
        """
        relevant_indices = [f"concepts_{id}" for id in vocab_ids]
        cluster_text = cluster_db.title
        cluster_embedding = self._calculate_embedding(cluster_text)

        # Use kNN with text boost for hybrid search (compatible with ES 8.x)
        query = {
            "size": 10,
            "knn": {
                "field": "embedding",
                "query_vector": cluster_embedding,
                "k": 50,
                "num_candidates": 100,  # perhaps more 500?
            },
            "query": {
                "multi_match": {
                    "query": cluster_text,
                    "fields": ["vocab_term_name"],
                    "boost": 0.3,
                }
            },
        }
        response = es_client.search(index=relevant_indices, body=query)
        concept_ids = [int(hit["_id"]) for hit in response["hits"]["hits"]]

        # TODO: implement reranking

        return concept_ids

    @staticmethod
    def _build_es_filters(
        domain_id: Optional[str] = None,
        concept_class_id: Optional[str] = None,
        standard_concept: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Build a list of ES term filters from non-None parameters.

        Args:
            domain_id: Filter by domain ID.
            concept_class_id: Filter by concept class ID.
            standard_concept: Filter by standard concept flag.

        Returns:
            List of ES term filter clauses.
        """
        filters: List[Dict[str, Any]] = []
        if domain_id is not None:
            filters.append({"term": {"domain_id": domain_id}})
        if concept_class_id is not None:
            filters.append({"term": {"concept_class_id": concept_class_id}})
        if standard_concept is not None:
            filters.append({"term": {"standard_concept": standard_concept}})
        return filters

    def search_concepts_vector(
        self,
        query_text: str,
        vocab_ids: List[int],
        limit: int = 10,
        offset: int = 0,
        domain_id: Optional[str] = None,
        concept_class_id: Optional[str] = None,
        standard_concept: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Search for concepts using vector similarity only.

        Performs pure semantic search using embeddings without text matching.
        Ideal for cross-lingual search where text matching is not useful.

        Args:
            query_text: The search query text.
            vocab_ids: List of vocabulary IDs to search across.
            limit: Maximum number of results to return.
            offset: Number of results to skip for pagination.
            domain_id: Filter by domain ID.
            concept_class_id: Filter by concept class ID.
            standard_concept: Filter by standard concept flag.

        Returns:
            A tuple of (results list, total hits count).
        """
        if not vocab_ids:
            return [], 0

        relevant_indices = [f"concepts_{id}" for id in vocab_ids]

        existing_indices = []
        for idx in relevant_indices:
            if es_client.indices.exists(index=idx):
                existing_indices.append(idx)

        if not existing_indices:
            logger.warning(
                f"No ES indices found for vocab_ids={vocab_ids} "
                f"(checked: {relevant_indices})"
            )
            return [], 0

        query_embedding = self._calculate_embedding(query_text)
        es_filters = self._build_es_filters(domain_id, concept_class_id, standard_concept)

        # Pure kNN vector search - no text matching
        knn_clause: Dict[str, Any] = {
            "field": "embedding",
            "query_vector": query_embedding,
            "k": max(limit + offset, 50),
            "num_candidates": 100,  # perhaps more - 500? cuz the precission is lower now (int8)
        }
        if es_filters:
            knn_clause["filter"] = {"bool": {"must": es_filters}}

        query = {
            "size": limit,
            "from": offset,
            "track_total_hits": True,
            "knn": knn_clause,
        }

        response = es_client.search(index=existing_indices, body=query)

        total_hits = response["hits"]["total"]
        if isinstance(total_hits, dict):
            total_hits = total_hits["value"]

        results = []
        for hit in response["hits"]["hits"]:
            vocab_id = int(hit["_index"].split("_")[1])
            results.append(
                {
                    "concept_id": int(hit["_id"]),
                    "score": float(hit["_score"]) if hit["_score"] else 0.0,
                    "vocab_id": vocab_id,
                }
            )

        return results, total_hits

    def search_concepts(
        self,
        query_text: str,
        vocab_ids: List[int],
        limit: int = 10,
        offset: int = 0,
        sort_by: str = "relevance",
        sort_order: str = "desc",
        domain_id: Optional[str] = None,
        concept_class_id: Optional[str] = None,
        standard_concept: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Search for concepts across multiple vocabularies with filters.

        Performs hybrid search (text + semantic) and returns results with scores.

        Args:
            query_text: The search query text.
            vocab_ids: List of vocabulary IDs to search across.
            limit: Maximum number of results to return.
            offset: Number of results to skip for pagination.
            sort_by: Field to sort by ('relevance', 'name', 'domain').
            sort_order: Sort direction ('asc' or 'desc').
            domain_id: Filter by domain ID.
            concept_class_id: Filter by concept class ID.
            standard_concept: Filter by standard concept flag.

        Returns:
            A tuple of (results list, total hits count).
        """
        if not vocab_ids:
            return [], 0

        relevant_indices = [f"concepts_{id}" for id in vocab_ids]

        # Check if any indices exist
        existing_indices = []
        for idx in relevant_indices:
            if es_client.indices.exists(index=idx):
                existing_indices.append(idx)

        if not existing_indices:
            logger.warning(
                f"No ES indices found for vocab_ids={vocab_ids} "
                f"(checked: {relevant_indices})"
            )
            return [], 0

        query_embedding = self._calculate_embedding(query_text)
        es_filters = self._build_es_filters(domain_id, concept_class_id, standard_concept)

        # Build kNN clause with optional pre-filtering
        knn_clause: Dict[str, Any] = {
            "field": "embedding",
            "query_vector": query_embedding,
            "k": max(limit + offset, 50),
            "num_candidates": 100,  # perhaps more - 500?
        }
        if es_filters:
            knn_clause["filter"] = {"bool": {"must": es_filters}}

        # Build text query — wrap in bool with filter when filters are active
        text_query: Dict[str, Any] = {
            "multi_match": {
                "query": query_text,
                "fields": ["vocab_term_name^2", "vocab_term_id"],
                "type": "best_fields",
                "boost": 0.3,
            }
        }
        if es_filters:
            text_query = {
                "bool": {
                    "must": [text_query],
                    "filter": es_filters,
                }
            }

        # Hybrid search: kNN + text boost (ES 8.x compatible)
        query = {
            "size": limit,
            "from": offset,
            "track_total_hits": True,
            "knn": knn_clause,
            "query": text_query,
        }

        # Add sorting if not by relevance
        if sort_by == "name":
            query["sort"] = [
                {
                    "vocab_term_name.keyword": {
                        "order": sort_order,
                        "unmapped_type": "keyword",
                    }
                }
            ]
        elif sort_by == "domain":
            query["sort"] = [
                {"domain_id.keyword": {"order": sort_order, "unmapped_type": "keyword"}}
            ]
        # For relevance, ES uses _score by default

        response = es_client.search(index=existing_indices, body=query)

        # Get total hits
        total_hits = response["hits"]["total"]
        if isinstance(total_hits, dict):
            total_hits = total_hits["value"]

        results = []
        for hit in response["hits"]["hits"]:
            # Extract vocab_id from index name (e.g., "concepts_1" -> 1)
            vocab_id = int(hit["_index"].split("_")[1])
            results.append(
                {
                    "concept_id": int(hit["_id"]),
                    "score": float(hit["_score"]) if hit["_score"] else 0.0,
                    "vocab_id": vocab_id,
                }
            )

        return results, total_hits


# ================================================
# Global instance
# ================================================

indexer = ConceptIndexer()
