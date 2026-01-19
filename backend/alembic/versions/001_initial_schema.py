"""initial schema

Revision ID: 001
Revises:
Create Date: 2025-12-12 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create User table
    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column(
            "hashed_password", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column("disabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_username"), "user", ["username"], unique=True)

    # Create Vocabulary table
    op.create_table(
        "vocabulary",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("uploaded", sa.DateTime(), nullable=False),
        sa.Column("version", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create Dataset table
    op.create_table(
        "dataset",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("uploaded", sa.DateTime(), nullable=False),
        sa.Column("last_modified", sa.DateTime(), nullable=False),
        sa.Column("labels", sa.JSON(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create Concept table
    op.create_table(
        "concept",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("vocab_term_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column(
            "vocab_term_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column("domain_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column(
            "concept_class_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column(
            "standard_concept", sqlmodel.sql.sqltypes.AutoString(), nullable=True
        ),
        sa.Column("concept_code", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("valid_start_date", sa.DateTime(), nullable=False),
        sa.Column("valid_end_date", sa.DateTime(), nullable=False),
        sa.Column("invalid_reason", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("vocabulary_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["vocabulary_id"], ["vocabulary.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create Record table
    op.create_table(
        "record",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("seq_number", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("date", sa.DateTime(), nullable=True),
        sa.Column("text", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("uploaded", sa.DateTime(), nullable=False),
        sa.Column("reviewed", sa.Boolean(), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["dataset.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create Cluster table
    op.create_table(
        "cluster",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("label", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["dataset.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cluster_dataset_id"), "cluster", ["dataset_id"], unique=False
    )

    # Create SourceTerm table
    op.create_table(
        "source_term",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("value", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("label", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("start_position", sa.Integer(), nullable=True),
        sa.Column("end_position", sa.Integer(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("automatically_extracted", sa.Boolean(), nullable=False),
        sa.Column("record_id", sa.Integer(), nullable=False),
        sa.Column("cluster_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["cluster_id"], ["cluster.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["record_id"], ["record.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create SourceToConceptMap table
    op.create_table(
        "source_to_concept_map",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cluster_id", sa.Integer(), nullable=False),
        sa.Column("concept_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["cluster_id"], ["cluster.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["concept_id"], ["concept.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    # Drop tables in reverse order (respecting foreign key constraints)
    op.drop_table("source_to_concept_map")
    op.drop_table("source_term")
    op.drop_table("cluster")
    op.drop_table("record")
    op.drop_table("concept")
    op.drop_table("dataset")
    op.drop_table("vocabulary")
    op.drop_index(op.f("ix_user_username"), table_name="user")
    op.drop_table("user")
