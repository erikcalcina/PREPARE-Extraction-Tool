from elasticsearch import Elasticsearch


ELASTIC_URL = "http://elasticsearch:9200"

es_client = Elasticsearch(ELASTIC_URL)

def check_connection():
    try:
        if es_client.ping():
            print("Connected to Elasticsearch")
        else:
            print("Could not connect to Elasticsearch")
    except Exception as e:
        print("Error connecting to Elasticsearch:", e)

print(check_connection())