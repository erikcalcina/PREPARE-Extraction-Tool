"""add index on vocabulary.user_id

Revision ID: 010
Revises: 009
Create Date: 2026-02-02 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_vocabulary_user_id", "vocabulary", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_vocabulary_user_id", table_name="vocabulary")
