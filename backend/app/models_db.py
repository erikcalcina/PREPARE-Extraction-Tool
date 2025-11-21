from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, Relationship, SQLModel


# SQLModel TABLE DEFINITIONS

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    hashed_password: str

class Dataset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    uploaded: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    labels: List[str] = Field(sa_column=Column(JSON))   # TODO: need to specify a structure for the labels

    # relationship to Records
    records: list["Record"] = Relationship(back_populates="dataset", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Record(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    uploaded: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # relationship back to Dataset
    dataset_id: int = Field(foreign_key="dataset.id", ondelete="CASCADE", nullable=False)
    dataset: Optional["Dataset"] = Relationship(back_populates="records")

    # relationship to SourceTerm
    source_terms: list["SourceTerm"] = Relationship(back_populates="record", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class SourceTerm(SQLModel, table=True):
    __tablename__ = "source_term"

    id: Optional[int] = Field(default=None, primary_key=True)
    value: str
    label: str

    # relationship back to Record
    record_id: int = Field(foreign_key="record.id", ondelete="CASCADE", nullable=False)
    record: Optional["Record"] = Relationship(back_populates="source_terms")

    # relationship to SourceToConceptMap
    mappings: list["SourceToConceptMap"] = Relationship(back_populates="source_term", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

    # self-referencing relationship
    alternative_id: Optional[int] = Field(default=None, foreign_key="source_term.id", ondelete="SET NULL")
    alternative: Optional["SourceTerm"] = Relationship(
        back_populates="alternative_children",
        sa_relationship_kwargs={"remote_side": "SourceTerm.id"}
    )

    # reverse relationship: all SourceTerms that point to this one
    alternative_children: list["SourceTerm"] = Relationship(
        back_populates="alternative"
    )

class Vocabulary(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    uploaded: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: str

    # relationship to Concept
    concepts: list["Concept"] = Relationship(back_populates="vocabulary", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Concept(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vocab_term_id: str
    vocab_term_name: str
    #vocab_term_*: *

    # relationship back to Vocabulary
    vocabulary_id: int = Field(foreign_key="vocabulary.id", ondelete="CASCADE", nullable=False)
    vocabulary: Optional["Vocabulary"] = Relationship(back_populates="concepts")

    # relationship to SourceToConceptMap
    mappings: list["SourceToConceptMap"] = Relationship(back_populates="concept", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class SourceToConceptMap(SQLModel, table=True):
    __tablename__ = "source_to_concept_map"

    id: Optional[int] = Field(default=None, primary_key=True)

    # relationship back to SourceTerm
    source_term_id: int = Field(foreign_key="source_term.id", ondelete="CASCADE", nullable=False)
    source_term: Optional["SourceTerm"] = Relationship(back_populates="mappings")

    # relationship back to Concept
    concept_id: int = Field(foreign_key="concept.id", ondelete="CASCADE", nullable=False)
    concept: Optional["Concept"] = Relationship(back_populates="mappings")