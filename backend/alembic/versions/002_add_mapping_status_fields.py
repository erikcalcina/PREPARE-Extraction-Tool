"""add mapping status fields

Revision ID: 002
Revises: 001
Create Date: 2024-12-14 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add status, created_at, updated_at fields to source_to_concept_map table
    op.add_column(
        "source_to_concept_map",
        sa.Column(
            "status",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "source_to_concept_map",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.add_column(
        "source_to_concept_map",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Add indexes for better query performance
    op.create_index(
        op.f("ix_source_to_concept_map_cluster_id"),
        "source_to_concept_map",
        ["cluster_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_source_to_concept_map_concept_id"),
        "source_to_concept_map",
        ["concept_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_source_to_concept_map_status"),
        "source_to_concept_map",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index(
        op.f("ix_source_to_concept_map_status"), table_name="source_to_concept_map"
    )
    op.drop_index(
        op.f("ix_source_to_concept_map_concept_id"), table_name="source_to_concept_map"
    )
    op.drop_index(
        op.f("ix_source_to_concept_map_cluster_id"), table_name="source_to_concept_map"
    )

    # Drop columns
    op.drop_column("source_to_concept_map", "updated_at")
    op.drop_column("source_to_concept_map", "created_at")
    op.drop_column("source_to_concept_map", "status")
