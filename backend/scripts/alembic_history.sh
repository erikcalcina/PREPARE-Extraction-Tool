#!/bin/bash
# Alembic Migration History Script
#
# This script displays the complete migration history showing all revisions.
#
# Usage:
#   ./scripts/alembic_history.sh
#
# Example:
#   ./scripts/alembic_history.sh

set -e  # Exit on error

# Change to backend directory (parent of scripts)
cd "$(dirname "$0")/.."

echo "==================================="
echo "Migration History"
echo "==================================="
echo ""

# Run alembic history with verbose output
alembic history --verbose

echo ""

