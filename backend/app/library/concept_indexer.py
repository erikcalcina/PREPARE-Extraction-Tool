from math import ceil

from typing import List, Union

from elasticsearch.exceptions import NotFoundError
from elasticsearch.helpers import bulk

from app.core.elastic import es_client
from app.core.model_registry import model_registry
from app.models_db import SourceTerm, Concept


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
            self._model = model_registry.get_model("embedding")
        return self._model

    @property
    def embedding_dim(self):
        """Get the dimension of the sentence embeddings.

        Returns:
            The dimensionality of the embedding vectors.
        """
        if self._embedding_dim is None:
            self._embedding_dim = 768
            # self._embedding_dim = self.model.get_sentence_embedding_dimension()
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
        return self.model.embed(text)

    def add_bulk_to_index(
        self, vocab_id: int, concepts: List[Concept], batch_size: int = 10
    ):
        """Add multiple concepts to the index in batches.

        Args:
            vocab_id: The vocabulary ID for the target index.
            concepts: List of Concept objects to add to the index.
            batch_size: Number of concepts to process per batch. Defaults to 10.
        """
        index_name = f"concepts_{vocab_id}"

        num_batches = ceil(len(concepts) / batch_size)
        for batch_idx in range(num_batches):
            actions = []

            start = batch_idx * batch_size
            batch = concepts[start : start + batch_size]

            texts = [c.vocab_term_name for c in batch]
            embeddings = self._calculate_embedding(texts)

            for c, vect_embedding in zip(batch, embeddings):
                doc = {
                    "_index": index_name,
                    "_id": c.id,
                    "_source": {
                        "vocab_term_id": c.vocab_term_id,
                        "vocab_term_name": c.vocab_term_name,
                        "embedding": vect_embedding,
                    },
                }
                actions.append(doc)

            bulk(es_client, actions)

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
        self, term_db: SourceTerm, vocab_ids: List[int]
    ) -> List[int]:
        """Map a source term to relevant concepts using semantic search.

        Performs embedding-based similarity search to find the most relevant
        concepts across specified vocabularies for a given source term.

        Args:
            term_db: The source term to map to concepts.
            vocab_ids: List of vocabulary IDs to search across.

        Returns:
            A list of concept IDs ordered by relevance (most relevant first).
        """
        relevant_indices = [f"concepts_{id}" for id in vocab_ids]
        term_text = term_db.value
        term_embedding = self._calculate_embedding(term_text)

        query = {
            "size": 10,
            "query": {
                "rrf": {
                    "queries": [
                        # text search: 1/3
                        {
                            "multi_match": {
                                "query": term_text,
                                "fields": ["vocab_term_name"]
                            }
                        },
                        # vector search: 2/3
                        {
                            "knn": {
                                "field": "embedding",
                                "query_vector": term_embedding,
                                "k": 50,    # returns top 50 results
                                "num_candidates": 100   # finds 100 most similar
                            }
                        },
                        {
                            "knn": {
                                "field": "embedding",
                                "query_vector": term_embedding,
                                "k": 50,
                                "num_candidates": 100
                            }
                        }
                    ],
                    "rank_constant": 60,    # 1 / (rank_constant + rank)
                    "window_size": 100  # how many to consider from each category
                }
            }
        }
        response = es_client.search(index=relevant_indices, body=query)
        concept_ids = [int(hit["_id"]) for hit in response["hits"]["hits"]]

        # TODO: implement reranking

        return concept_ids


# ================================================
# Global instance
# ================================================

indexer = ConceptIndexer()
