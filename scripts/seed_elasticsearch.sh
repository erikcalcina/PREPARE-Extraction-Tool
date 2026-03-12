#!/bin/bash
# ============================================================
# seed_elasticsearch.sh
# Restore Elasticsearch snapshot for concepts_* indices.
#
# Predpogoji:
# - Elasticsearch teče
# - docker-compose.yml vsebuje:
#     - path.repo=/usr/share/elasticsearch/snapshots
#     - ./seed_data/es_repo:/usr/share/elasticsearch/snapshots
# - snapshot repository datoteke so v seed_data/es_repo
# ============================================================

set -euo pipefail

ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
REPO_NAME="${ES_REPO_NAME:-seed_repo}"
SNAPSHOT_NAME="${ES_SNAPSHOT_NAME:-seed_snapshot}"


echo "⏳ Čakam na Elasticsearch..."
until curl -fsS "$ES_URL/_cluster/health" > /dev/null; do
  sleep 3
done
echo "✅ Elasticsearch je pripravljen."

echo "📦 Registriram snapshot repository '$REPO_NAME'..."
curl -fsS -X PUT "$ES_URL/_snapshot/$REPO_NAME" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "fs",
    "settings": {
      "location": "/usr/share/elasticsearch/snapshots"
    }
  }'

echo
echo "🔎 Preverjam, ali snapshot '$SNAPSHOT_NAME' obstaja..."
curl -fsS "$ES_URL/_snapshot/$REPO_NAME/$SNAPSHOT_NAME?pretty" > /dev/null
echo "✅ Snapshot obstaja."

echo
echo "🧹 Brišem obstoječe concepts_* indekse, če obstajajo..."
curl -fsS -X DELETE "$ES_URL/concepts_*" > /dev/null || true
echo "✅ Stari concepts_* indeksi odstranjeni ali pa jih ni bilo."

echo
echo "♻️ Restoram snapshot '$SNAPSHOT_NAME'..."
curl -fsS -X POST "$ES_URL/_snapshot/$REPO_NAME/$SNAPSHOT_NAME/_restore?wait_for_completion=true" \
  -H "Content-Type: application/json" \
  -d '{
    "indices": "concepts_*",
    "include_global_state": false,
    "ignore_unavailable": true,
    "index_settings": {
      "index.number_of_replicas": 0
    }
  }'

echo
echo "📊 Končno stanje indeksov:"
curl -fsS "$ES_URL/_cat/indices/concepts_*?v"

echo
echo "✅ Elasticsearch seed uspešno končan."