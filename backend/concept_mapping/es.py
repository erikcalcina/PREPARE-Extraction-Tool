from es_client import es_client
from elasticsearch.exceptions import NotFoundError
from elasticsearch.helpers import bulk

from sentence_transformers import SentenceTransformer

from app.models_db import SourceTerm, Concept

def create_concept_index(vocab_id: int, embedding_dim: int = 768):
    index_name = f"concepts_{vocab_id}"
    if not es_client.indices.exists(index=index_name):
        mapping = {
            "mappings": {
                "properties": {
                    "vocab_term_id": {"type": "keyword"},
                    "vocab_term_name": {"type": "text"},
                    "embedding": {"type": "dense_vector", "dims": embedding_dim}
                }
            }
        }
        es_client.indices.create(index=index_name, body=mapping)
        print(f"Created index '{index_name}'")
    else:
        print(f"Index '{index_name}' already exists")


def delete_index(vocab_id: int):
    index_name= f"concepts_{vocab_id}"
    
    if es_client.indices.exists(index=index_name):
        es_client.indices.delete(index=index_name)
        print(f"Index {index_name} deleted")
    else:
        print(f"Index {index_name} not found")


def add_bulk_to_index(vocab_id: int, concepts: list[Concept]):
    index_name = f"concepts_{vocab_id}"

    actions = []
    for c in concepts:
        vect_embedding = calculate_embedding(c.vocab_term_name)
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


def add_concept_to_index(vocab_id: int, concept_db: Concept):
    # create embedding vector + add to index
    concept_text = concept_db.vocab_term_name
    vect_embedding = calculate_embedding(concept_text)
    
    doc = {
        "vocab_term_id": concept_db.vocab_term_id,
        "vocab_term_name": concept_text,
        "embedding": vect_embedding
    }

    es_client.index(index=f"concepts_{vocab_id}", id=concept_db.id, document=doc)


def delete_concept_from_index(vocab_id: int, concept_id: int):
    index_name= f"concepts_{vocab_id}"
    
    try:
        es_client.delete(index=index_name, id=concept_id)
        print(f"Document {concept_id} deleted from {index_name}")
    except NotFoundError:
        print(f"Document {concept_id} not found in {index_name}")


def calculate_embedding(text: str) -> list:
    # remove model initialization
    embedding_model = SentenceTransformer("neuml/pubmedbert-base-embeddings")
    return embedding_model.encode(text).tolist()


def es_map_term_to_concept(term_db: SourceTerm, vocab_id: int) -> int:
    index_name= f"concepts_{vocab_id}"
    embedding = calculate_embedding(term_db.value)

    # TODO: implement hybrid search + reranking
    concept_id = 1
    return concept_id
