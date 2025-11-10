from elasticsearch import Elasticsearch
from sentence_transformers import SentenceTransformer

ELASTIC_URL = "http://elasticsearch:9200"

es_client = Elasticsearch(ELASTIC_URL)


# initialize embedding model
embedding_model = SentenceTransformer("neuml/pubmedbert-base-embeddings")

def check_connection():
    try:
        if es_client.ping():
            print("Connected to Elasticsearch")
        else:
            print("Could not connect to Elasticsearch")
    except Exception as e:
        print("Error connecting to Elasticsearch:", e)

print(check_connection())