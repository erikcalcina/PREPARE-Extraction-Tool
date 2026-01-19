from math import ceil

from typing import List, Union, Optional, Dict, Any

from elasticsearch.exceptions import NotFoundError
from elasticsearch.helpers import bulk

from app.core.elastic import es_client
from app.core.model_registry import model_registry
from app.models_db import SourceTerm, Concept, Cluster

from model2vec import StaticModel

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
            #self._model = model_registry.get_model("embedding")
            self._model = StaticModel.from_pretrained("minishlab/potion-multilingual-128M")
        return self._model


    @property
    def embedding_dim(self):
        """Get the dimension of the sentence embeddings.

        Returns:
            The dimensionality of the embedding vectors.
        """
        if self._embedding_dim is None:
            test_emb = self._calculate_embedding("test")
            self._embedding_dim = test_emb.shape[0]
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
                        "embedding": {
                            "type": "dense_vector",
                            "dims": self.embedding_dim,
                        },
                    }
                }
            }
            es_client.indices.create(index=index_name, body=mapping)
            print(f"Created index '{index_name}' successfully")
        else:
            print(f"Index '{index_name}' already exists, skipping creation")

    def delete_index(self, vocab_id: int):
        """Delete an Elasticsearch index for a vocabulary.

        Args:
            vocab_id: The vocabulary ID whose index should be deleted.
        """
        index_name = f"concepts_{vocab_id}"

        if es_client.indices.exists(index=index_name):
            es_client.indices.delete(index=index_name)
            print(f"Index {index_name} deleted successfully")
        else:
            print(f"Index {index_name} not found, skipping deletion")

    def _calculate_embedding(self, text: Union[str, List[str]]) -> List[float]:
        """Calculate embedding vector(s) for the given text.

        Args:
            text: A single text string or a list of text strings to embed.

        Returns:
            A list containing the embedding vector(s).
        """
        # return self.model.embed(text)
        return self.model.encode(text)


    def add_bulk_to_index(
        self,
        vocab_id: int,
        concepts: List[Concept],
        embed_batch_size: int = 512,
    ):
        index_name = f"concepts_{vocab_id}"

        for i in range(0, len(concepts), embed_batch_size):
            embed_batch = concepts[i : i + embed_batch_size]

            texts = [c.vocab_term_name for c in embed_batch]
            embeddings = self._calculate_embedding(texts)

            actions = []
            for c, emb in zip(embed_batch, embeddings):
                actions.append({
                    "_index": index_name,
                    "_id": c.id,
                    "_source": {
                        "vocab_term_id": c.vocab_term_id,
                        "vocab_term_name": c.vocab_term_name,
                        "embedding": [float(x) for x in emb],
                    },
                })

            success, errors = bulk(
                es_client,
                actions,
                raise_on_error=False,
                raise_on_exception=False,
            )

            if errors:
                print(f"ES bulk failed for batch starting at {i}")
                print(f"Failed docs: {len(errors)}")

                for err in errors[:3]:
                    print("ES error:", err)

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
            "embedding": vect_embedding,
        }

        es_client.index(index=f"concepts_{vocab_id}", id=concept_db.id, document=doc)

    def delete_concept_from_index(self, vocab_id: int, concept_id: int):
        """Delete a concept from the index.

        Args:
            vocab_id: The vocabulary ID for the target index.
            concept_id: The ID of the concept to delete.
        """
        index_name = f"concepts_{vocab_id}"

        try:
            es_client.delete(index=index_name, id=concept_id)
            print(f"Document {concept_id} deleted from {index_name} successfully")
        except NotFoundError:
            print(f"Document {concept_id} not found in {index_name}, skipping deletion")

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

        query = {
            "size": 10,
            "query": {
                "rrf": {
                    "queries": [
                        # text search: 1/3
                        {
                            "multi_match": {
                                "query": cluster_text,
                                "fields": ["vocab_term_name"],
                            }
                        },
                        # vector search: 2/3
                        {
                            "knn": {
                                "field": "embedding",
                                "query_vector": cluster_embedding,
                                "k": 50,  # returns top 50 results
                                "num_candidates": 100,  # finds 100 most similar
                            }
                        },
                        {
                            "knn": {
                                "field": "embedding",
                                "query_vector": cluster_embedding,
                                "k": 50,
                                "num_candidates": 100,
                            }
                        },
                    ],
                    "rank_constant": 60,  # 1 / (rank_constant + rank)
                    "window_size": 100,  # how many to consider from each category
                }
            },
        }
        response = es_client.search(index=relevant_indices, body=query)
        concept_ids = [int(hit["_id"]) for hit in response["hits"]["hits"]]

        # TODO: implement reranking

        return concept_ids

    def search_concepts(
        self,
        query_text: str,
        vocab_ids: List[int],
        limit: int = 10,
        domain_id: Optional[str] = None,
        concept_class_id: Optional[str] = None,
        standard_concept: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search for concepts across multiple vocabularies with filters.

        Performs hybrid search (text + semantic) and returns results with scores.
        Results are from Elasticsearch only - database filtering happens in the route.

        Args:
            query_text: The search query text.
            vocab_ids: List of vocabulary IDs to search across.
            limit: Maximum number of results to return.
            domain_id: Optional domain filter (applied in DB layer).
            concept_class_id: Optional concept class filter (applied in DB layer).
            standard_concept: Optional standard concept filter (applied in DB layer).

        Returns:
            A list of dictionaries with 'concept_id', 'score', and 'vocab_id'.
        """
        if not vocab_ids:
            return []

        relevant_indices = [f"concepts_{id}" for id in vocab_ids]

        # Check if any indices exist
        existing_indices = []
        for idx in relevant_indices:
            if es_client.indices.exists(index=idx):
                existing_indices.append(idx)

        if not existing_indices:
            return []

        query_embedding = self._calculate_embedding(query_text)

        # Use RRF (Reciprocal Rank Fusion) for hybrid search
        query = {
            "size": limit * 2,  # Get more to account for DB filtering
            "query": {
                "rrf": {
                    "queries": [
                        # Text search
                        {
                            "multi_match": {
                                "query": query_text,
                                "fields": ["vocab_term_name^2", "vocab_term_id"],
                                "type": "best_fields",
                            }
                        },
                        # Vector search (weighted more heavily)
                        {
                            "knn": {
                                "field": "embedding",
                                "query_vector": query_embedding,
                                "k": 50,
                                "num_candidates": 100,
                            }
                        },
                        {
                            "knn": {
                                "field": "embedding",
                                "query_vector": query_embedding,
                                "k": 50,
                                "num_candidates": 100,
                            }
                        },
                    ],
                    "rank_constant": 60,
                    "window_size": 100,
                }
            },
        }

        try:
            response = es_client.search(index=existing_indices, body=query)

            results = []
            for hit in response["hits"]["hits"]:
                # Extract vocab_id from index name (e.g., "concepts_1" -> 1)
                vocab_id = int(hit["_index"].split("_")[1])
                results.append(
                    {
                        "concept_id": int(hit["_id"]),
                        "score": float(hit["_score"]),
                        "vocab_id": vocab_id,
                    }
                )

            return results
        except Exception as e:
            print(f"Error searching concepts: {e}")
            return []


# ================================================
# Global instance
# ================================================

indexer = ConceptIndexer()
