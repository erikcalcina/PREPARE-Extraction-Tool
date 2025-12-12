#!/usr/bin/env python3
"""
Database Migration CLI Tool

This script provides a convenient wrapper around Alembic commands
for managing database migrations.

Usage:
    python scripts/db_migrate.py upgrade      # Apply all pending migrations
    python scripts/db_migrate.py downgrade    # Rollback one migration
    python scripts/db_migrate.py current      # Show current revision
    python scripts/db_migrate.py history      # Show migration history
    python scripts/db_migrate.py revision     # Create new migration (autogenerate)
    python scripts/db_migrate.py stamp head   # Mark database as up-to-date without running migrations
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from alembic.config import Config
from alembic import command


def get_alembic_config() -> Config:
    """Get Alembic configuration."""
    alembic_ini_path = backend_dir / "alembic.ini"

    if not alembic_ini_path.exists():
        print(f"Error: Alembic configuration not found at {alembic_ini_path}")
        sys.exit(1)

    return Config(str(alembic_ini_path))


def upgrade(revision: str = "head"):
    """Apply migrations up to the specified revision."""
    print(f"Upgrading database to revision: {revision}")
    alembic_cfg = get_alembic_config()
    command.upgrade(alembic_cfg, revision)
    print("✓ Database upgraded successfully")


def downgrade(revision: str = "-1"):
    """Rollback migrations to the specified revision."""
    print(f"Downgrading database to revision: {revision}")
    alembic_cfg = get_alembic_config()
    command.downgrade(alembic_cfg, revision)
    print("✓ Database downgraded successfully")


def current():
    """Show current database revision."""
    print("Current database revision:")
    alembic_cfg = get_alembic_config()
    command.current(alembic_cfg, verbose=True)


def history():
    """Show migration history."""
    print("Migration history:")
    alembic_cfg = get_alembic_config()
    command.history(alembic_cfg, verbose=True)


def revision(message: str = None, autogenerate: bool = True):
    """Create a new migration revision."""
    if not message:
        message = input("Enter migration message: ").strip()
        if not message:
            print("Error: Migration message is required")
            sys.exit(1)

    print(f"Creating new migration: {message}")
    alembic_cfg = get_alembic_config()
    command.revision(alembic_cfg, message=message, autogenerate=autogenerate)
    print("✓ Migration created successfully")
    print("\nPlease review the generated migration file before applying it!")


def stamp(revision: str = "head"):
    """Mark the database as being at a specific revision without running migrations."""
    print(f"Stamping database with revision: {revision}")
    alembic_cfg = get_alembic_config()
    command.stamp(alembic_cfg, revision)
    print("✓ Database stamped successfully")


def show_help():
    """Show help message."""
    print(__doc__)
    print("\nAvailable commands:")
    print("  upgrade [revision]       Apply migrations (default: head)")
    print("  downgrade [revision]     Rollback migrations (default: -1)")
    print("  current                  Show current revision")
    print("  history                  Show migration history")
    print("  revision [message]       Create new migration with autogenerate")
    print("  stamp [revision]         Mark database at revision (default: head)")
    print("  help                     Show this help message")


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        show_help()
        sys.exit(1)

    command_name = sys.argv[1].lower()

    try:
        if command_name == "upgrade":
            revision = sys.argv[2] if len(sys.argv) > 2 else "head"
            upgrade(revision)

        elif command_name == "downgrade":
            revision = sys.argv[2] if len(sys.argv) > 2 else "-1"
            downgrade(revision)

        elif command_name == "current":
            current()

        elif command_name == "history":
            history()

        elif command_name == "revision":
            message = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else None
            revision(message)

        elif command_name == "stamp":
            revision = sys.argv[2] if len(sys.argv) > 2 else "head"
            stamp(revision)

        elif command_name in ("help", "-h", "--help"):
            show_help()

        else:
            print(f"Error: Unknown command '{command_name}'")
            show_help()
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

