#!/bin/bash
# Alembic Auto-generate Migration Script
#
# This script automatically generates a new Alembic migration with sequential revision IDs.
# It scans existing migrations to determine the next revision number (001, 002, 003, etc.)
# and runs alembic's autogenerate feature to detect model changes.
#
# Usage:
#   ./scripts/alembic_autogenerate.sh "migration message"
#   ./scripts/alembic_autogenerate.sh
#
# Examples:
#   ./scripts/alembic_autogenerate.sh "add user preferences table"
#   ./scripts/alembic_autogenerate.sh

set -e  # Exit on error

# Change to backend directory (parent of scripts)
cd "$(dirname "$0")/.."

# Find next revision ID by scanning existing migrations
VERSIONS_DIR="alembic/versions"
LAST_ID=$(ls -1 "$VERSIONS_DIR"/*.py 2>/dev/null | grep -oE '[0-9]{3}' | sort -n | tail -1)
NEXT_ID=$(printf "%03d" $((10#${LAST_ID:-0} + 1)))

echo "==================================="
echo "Alembic Auto-generate Migration"
echo "==================================="
echo "Next revision ID: $NEXT_ID"
echo ""

# Get migration message from argument or prompt
MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
    read -p "Enter migration message: " MESSAGE
fi

if [ -z "$MESSAGE" ]; then
    echo "Error: Migration message is required"
    exit 1
fi

echo ""
echo "Generating migration: $MESSAGE"
echo ""

# Run alembic autogenerate
alembic revision --autogenerate --rev-id "$NEXT_ID" -m "$MESSAGE"

echo ""
echo "✓ Migration generated successfully!"
echo ""
echo "⚠️  IMPORTANT: Please review the generated migration file before applying it."
echo "   Alembic's autogenerate is not perfect and may miss some changes."
echo ""
echo "Next steps:"
echo "  1. Review: alembic/versions/${NEXT_ID}_*.py"
echo "  2. Apply:  ./scripts/alembic_upgrade.sh"
echo ""

