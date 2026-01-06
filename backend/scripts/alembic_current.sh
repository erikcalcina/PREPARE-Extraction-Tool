#!/bin/bash
# Alembic Current Revision Script
#
# This script displays the current database migration revision.
#
# Usage:
#   ./scripts/alembic_current.sh
#
# Example:
#   ./scripts/alembic_current.sh

set -e  # Exit on error

# Change to backend directory (parent of scripts)
cd "$(dirname "$0")/.."

echo "==================================="
echo "Current Database Revision"
echo "==================================="
echo ""

# Run alembic current with verbose output
alembic current --verbose

echo ""

