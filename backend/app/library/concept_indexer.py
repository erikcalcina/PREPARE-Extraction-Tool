from math import ceil

from elasticsearch.exceptions import NotFoundError
from elasticsearch.helpers import bulk

from app.core.elastic import es_client
from app.core.model_registry import model_registry
from app.models_db import SourceTerm, Concept


# ================================================
# Concept indexer in elasticsearch
# ================================================

class ConceptIndexer:

    def __init__(self):
        self._model = None
        self._embedding_dim = None

    @property
    def model(self):
        if self._model is None:
            self._model = model_registry.get_model("embedding")
        return self._model

    @property
    def embedding_dim(self):
        if self._embedding_dim is None:
            self._embedding_dim = self.model.get_sentence_embedding_dimension()
        return self._embedding_dim

    def create_concept_index(self, vocab_id: int):
        index_name = f"concepts_{vocab_id}"
        if not es_client.indices.exists(index=index_name):
            mapping = {
                "mappings": {
                    "properties": {
                        "vocab_term_id": {"type": "keyword"},   # are they unique?
                        "vocab_term_name": {"type": "text"},
                        "embedding": {"type": "dense_vector", "dims": self.embedding_dim}
                    }
                }
            }
            es_client.indices.create(index=index_name, body=mapping)
            print(f"Created index '{index_name}'")
        else:
            print(f"Index '{index_name}' already exists")

    def delete_index(self, vocab_id: int):
        index_name= f"concepts_{vocab_id}"

        if es_client.indices.exists(index=index_name):
            es_client.indices.delete(index=index_name)
            print(f"Index {index_name} deleted")
        else:
            print(f"Index {index_name} not found")

    def _calculate_embedding(self, text: str | list[str]) -> list:
        return self.model.embed(text)

    def add_bulk_to_index(self, vocab_id: int, concepts: list[Concept], batch_size: int = 10):
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
                        "embedding": vect_embedding
                    }
                }
                actions.append(doc)

            bulk(es_client, actions)


    def add_concept_to_index(self, vocab_id: int, concept_db: Concept):
        # create embedding vector + add to index
        concept_text = concept_db.vocab_term_name
        vect_embedding = self._calculate_embedding(concept_text)

        doc = {
            "vocab_term_id": concept_db.vocab_term_id,
            "vocab_term_name": concept_text,
            "embedding": vect_embedding
        }

        es_client.index(index=f"concepts_{vocab_id}", id=concept_db.id, document=doc)


    def delete_concept_from_index(self, vocab_id: int, concept_id: int):
        index_name= f"concepts_{vocab_id}"

        try:
            es_client.delete(index=index_name, id=concept_id)
            print(f"Document {concept_id} deleted from {index_name}")
        except NotFoundError:
            print(f"Document {concept_id} not found in {index_name}")


    def es_map_term_to_concept(self, term_db: SourceTerm, vocab_ids: list) -> list[int]:
        relevant_indices = [f"concepts_{id}" for id in vocab_ids]
        term_text = term_db.value
        term_embedding = self._calculate_embedding(term_text)

        # query = {
        #     "size": 10,
        #     "query": {
        #         "script_score": {
        #             "query": {
        #                 # BM25 match (only text)
        #                 "multi_match": {
        #                     "query": term_text,
        #                     "fields": ["vocab_term_name"]
        #                 }
        #             },
        #             "script": {
        #                 # + 1.0 to make score positive
        #                 "source": "0.3 * _score + 0.7 * (cosineSimilarity(params.query_vector, 'embedding') + 1.0)",
        #                 "params": {"query_vector": term_embedding}
        #             }
        #         }
        #     }
        # }
        query = {
            "size": 10,
            "query": {
                "script_score": {
                    "query": {"match_all": {}},
                    "script": {
                        "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                        "params": {"query_vector": term_embedding}
                    }
                }
            }
        }
        response = es_client.search(index=relevant_indices, body=query)
        concept_ids = [int(hit["_id"]) for hit in response["hits"]["hits"]]

        # TODO: implement reranking

        return concept_ids


# --- GLOBAL INSTANCE ---
indexer = ConceptIndexer()
