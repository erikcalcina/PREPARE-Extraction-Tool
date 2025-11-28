from elasticsearch import Elasticsearch
from app.core.settings import settings

# ================================================
# Elasticsearch client initialization
# ================================================

es_client = Elasticsearch(settings.ELASTICSEARCH_URL)

# ================================================
# Elasticsearch functions
# ================================================


def check_es_connection():
    """Check the connection to Elasticsearch and print the connection status."""
    try:
        if es_client.ping():
            print("Connected to Elasticsearch")
        else:
            print("Could not connect to Elasticsearch")
    except Exception as e:
        print("Error connecting to Elasticsearch:", e)
