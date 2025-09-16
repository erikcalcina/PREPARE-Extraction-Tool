from sqlalchemy import Column, JSON, ForeignKey
from sqlmodel import SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime, timezone


# DEFINIRANE TABELE

class User(SQLModel, table=True):
    user_id: Optional[int] = Field(default=None, primary_key=True)
    user_name: str
    user_pass: str

class Dataset(SQLModel, table=True):
    dataset_id: Optional[int] = Field(default=None, primary_key=True)
    dataset_name: str
    dataset_uploaded: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    dataset_labels: List[str] = Field(sa_column=Column(JSON))

    # relationship to Records
    records: list["Record"] = Relationship(back_populates="dataset", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Record(SQLModel, table=True):
    record_id: Optional[int] = Field(default=None, primary_key=True)
    record_text: str
    record_dataset_id: int = Field(
        sa_column=Column(ForeignKey("dataset.dataset_id", ondelete="CASCADE"))
    )
    record_uploaded: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # relationship back to Dataset
    dataset: Optional["Dataset"] = Relationship(back_populates="records")

    # relationship to SourceTerm
    source_terms: list["SourceTerm"] = Relationship(back_populates="record", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class SourceTerm(SQLModel, table=True):
    __tablename__ = "source_term"

    term_id: Optional[int] = Field(default=None, primary_key=True)
    record_id: int = Field(
        sa_column=Column(ForeignKey("record.record_id", ondelete="CASCADE"))
    )
    term_value: str
    term_label: str
    alternative_id: Optional[int] = Field(
        default=None,
        sa_column=Column(ForeignKey("source_term.term_id", ondelete="SET NULL"))
    )

    # relationship back to Record
    record: Optional["Record"] = Relationship(back_populates="source_terms")

    # relationship to SourceToConceptMap
    mappings: list["SourceToConceptMap"] = Relationship(back_populates="source_term", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

    # self-referencing relationship
    alternative: Optional["SourceTerm"] = Relationship(
        back_populates="alternative_children",
        sa_relationship_kwargs={"remote_side": "SourceTerm.term_id"}
    )
    # reverse relationship: all SourceTerms that point to this one
    alternative_children: list["SourceTerm"] = Relationship(
        back_populates="alternative"
    )

class Vocabulary(SQLModel, table=True):
    vocab_id: Optional[int] = Field(default=None, primary_key=True)
    vocab_name: str
    vocab_uploaded: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    vocab_version: str

    # relationship to Concept
    concepts: list["Concept"] = Relationship(back_populates="vocabulary", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Concept(SQLModel, table=True):
    concept_id: Optional[int] = Field(default=None, primary_key=True)
    vocab_id: int = Field(
        sa_column=Column(ForeignKey("vocabulary.vocab_id", ondelete="CASCADE"))
    )
    vocab_term_id: str
    vocab_term_name: str
    #vocab_term_*: *

    # relationship back to Vocabulary
    vocabulary: Optional["Vocabulary"] = Relationship(back_populates="concepts")

    # relationship to SourceToConceptMap
    mappings: list["SourceToConceptMap"] = Relationship(back_populates="concept", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class SourceToConceptMap(SQLModel, table=True):
    __tablename__ = "source_to_concept_map"

    map_id: Optional[int] = Field(default=None, primary_key=True)
    source_term_id: int = Field(
        sa_column=Column(ForeignKey("source_term.term_id", ondelete="CASCADE"))
    )
    concept_id: int = Field(
        sa_column=Column(ForeignKey("concept.concept_id", ondelete="CASCADE"))
    )

    # relationship back to SourceTerm
    source_term: Optional["SourceTerm"] = Relationship(back_populates="mappings")

    # relationship back to Concept
    concept: Optional["Concept"] = Relationship(back_populates="mappings")