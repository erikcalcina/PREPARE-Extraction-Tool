"""add comment to source_to_concept_map

Revision ID: 014
Revises: 013
Create Date: 2026-03-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "source_to_concept_map",
        sa.Column("comment", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("source_to_concept_map", "comment")
