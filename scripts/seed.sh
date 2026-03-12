#!/bin/bash
# ============================================================
# seed.sh
# Glavni seed skript za PREPARE-USAGI
#
# Predpogoj:
#   cp .env.example .env
#   docker-compose up -d
#   docker-compose exec backend alembic upgrade head
#
# Nato:
#   ./seed.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_CMD="docker compose"

# ------------------------------------------------------------
# Load .env
# ------------------------------------------------------------
if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
else
  echo "❌ .env datoteka ne obstaja."
  echo "   Najprej zaženi: cp .env.example .env"
  exit 1
fi

echo "======================================================"
echo "  PREPARE-USAGI Seed podatkov"
echo "======================================================"
echo "To bo uvozilo seed podatke v PostgreSQL in Elasticsearch."
echo

# ------------------------------------------------------------
# Wait for PostgreSQL
# ------------------------------------------------------------
echo "⏳ Čakam na PostgreSQL..."
until docker exec PREPARE-USAGI-POSTGRESQL \
  pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null 2>&1
do
  sleep 3
done
echo "✅ PostgreSQL je pripravljen."

# ------------------------------------------------------------
# Check migrations
# ------------------------------------------------------------
echo "🔎 Preverjam, ali so migracije že izvedene..."
if ! docker exec -i PREPARE-USAGI-POSTGRESQL \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT to_regclass('public.vocabulary');" \
  | grep -q "vocabulary"; then
  echo "❌ Tabela 'vocabulary' ne obstaja."
  echo "   Najprej zaženi: docker compose exec backend alembic upgrade head"
  exit 1
fi
echo "✅ Migracije so izvedene."

# ------------------------------------------------------------
# Wait for Elasticsearch
# ------------------------------------------------------------
echo "⏳ Čakam na Elasticsearch..."
until curl -fsS "http://localhost:9200/_cluster/health" > /dev/null; do
  sleep 3
done
echo "✅ Elasticsearch je pripravljen."

# ------------------------------------------------------------
# Run PostgreSQL seed
# ------------------------------------------------------------
echo
echo "📦 [1/2] PostgreSQL seed..."
bash "$SCRIPT_DIR/seed_postgres.sh"

# ------------------------------------------------------------
# Run Elasticsearch seed
# ------------------------------------------------------------
echo
echo "📦 [2/2] Elasticsearch seed..."
bash "$SCRIPT_DIR/seed_elasticsearch.sh"

echo
echo "======================================================"
echo "✅ Seed uspešno končan."
echo "======================================================"