#!/bin/bash
# Alembic Downgrade Script
#
# This script rolls back Alembic migrations to revert database schema changes.
#
# Usage:
#   ./scripts/alembic_downgrade.sh [revision]
#
# Examples:
#   ./scripts/alembic_downgrade.sh        # Rollback one migration
#   ./scripts/alembic_downgrade.sh -2     # Rollback two migrations
#   ./scripts/alembic_downgrade.sh 002    # Rollback to specific revision

set -e  # Exit on error

# Change to backend directory (parent of scripts)
cd "$(dirname "$0")/.."

REVISION="${1:--1}"

echo "==================================="
echo "Alembic Database Rollback"
echo "==================================="
echo "Target revision: $REVISION"
echo ""

# Run alembic downgrade
alembic downgrade "$REVISION"

echo ""
echo "✓ Database rollback completed successfully!"
echo ""

