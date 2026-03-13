#!/bin/bash
# ============================================================
# seed_elasticsearch.sh
# Restore Elasticsearch snapshot for concepts_* indices.
#
# Prerequisites:
# - Elasticsearch is running
# - docker-compose.yml contains:
#     - path.repo=/usr/share/elasticsearch/snapshots
#     - ./seed_data/es_repo:/usr/share/elasticsearch/snapshots
# - snapshot repository files are in seed_data/es_repo
# ============================================================

set -euo pipefail

ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
REPO_NAME="${ES_REPO_NAME:-seed_repo}"
SNAPSHOT_NAME="${ES_SNAPSHOT_NAME:-seed_snapshot}"


echo "Waiting for Elasticsearch..."
until curl -fsS "$ES_URL/_cluster/health" > /dev/null; do
  sleep 3
done
echo "✅ Elasticsearch is ready."

echo "Registering snapshot repository '$REPO_NAME'..."
curl -fsS -X PUT "$ES_URL/_snapshot/$REPO_NAME" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "fs",
    "settings": {
      "location": "/usr/share/elasticsearch/snapshots"
    }
  }'

echo
echo "Checking if snapshot '$SNAPSHOT_NAME' exists..."
curl -fsS "$ES_URL/_snapshot/$REPO_NAME/$SNAPSHOT_NAME?pretty" > /dev/null
echo "✅ Snapshot exists."

echo
echo "Deleting existing concepts_* indices, if they exist..."
curl -fsS -X DELETE "$ES_URL/concepts_*" > /dev/null || true
echo "✅ Old concepts_* indices removed or did not exist."

echo
echo "Restoring snapshot '$SNAPSHOT_NAME'..."
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
echo "Final index status:"
curl -fsS "$ES_URL/_cat/indices/concepts_*?v"

echo
echo "✅ Elasticsearch seed completed successfully."