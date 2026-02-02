"""add refresh token table and concept vocabulary index

Revision ID: 008
Revises: 007
Create Date: 2026-01-27 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "refresh_token",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, default=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_refresh_token_token"), "refresh_token", ["token"], unique=True
    )

    op.create_index(
        op.f("ix_concept_vocabulary_id"), "concept", ["vocabulary_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_concept_vocabulary_id"), table_name="concept")
    op.drop_index(op.f("ix_refresh_token_token"), table_name="refresh_token")
    op.drop_table("refresh_token")
