#!/bin/bash
# Alembic Upgrade Script
#
# This script applies all pending Alembic migrations to bring the database
# up to date with the latest schema.
#
# Usage:
#   ./scripts/alembic_upgrade.sh [revision]
#
# Examples:
#   ./scripts/alembic_upgrade.sh        # Upgrade to latest (head)
#   ./scripts/alembic_upgrade.sh +1     # Upgrade by one revision
#   ./scripts/alembic_upgrade.sh 002    # Upgrade to specific revision

set -e  # Exit on error

# Change to backend directory (parent of scripts)
cd "$(dirname "$0")/.."

REVISION="${1:-head}"

echo "==================================="
echo "Alembic Database Migration"
echo "==================================="
echo "Target revision: $REVISION"
echo ""

# Run alembic upgrade
alembic upgrade "$REVISION"

echo ""
echo "✓ Database migration completed successfully!"
echo ""

