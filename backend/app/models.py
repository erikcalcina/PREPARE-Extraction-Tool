from typing import List

from sqlmodel import SQLModel, Field
from app.models_db import Dataset, Record, Vocabulary, Concept


class UserModel(SQLModel):
    username: str
    password: str


class MessageOutput(SQLModel):
    message: str


class MapRequest(SQLModel):
    vocabulary_ids: List[int]


class SourceTermCreate(SQLModel):
    value: str
    label: str


class ConceptCreate(SQLModel):
    vocab_term_id: str
    vocab_term_name: str


class VocabularyCreate(SQLModel):
    name: str
    version: str
    concepts: List[ConceptCreate] = Field(default_factory=list)


class RecordCreate(SQLModel):
    text: str


class DatasetCreate(SQLModel):
    name: str
    labels: List[str] = Field(default_factory=list)
    records: List[RecordCreate] = Field(default_factory=list)


class DatasetsOutput(SQLModel):
    datasets: List[Dataset]


class DatasetOutput(SQLModel):
    dataset: Dataset


class RecordsOutput(SQLModel):
    records: List[Record]


class RecordOutput(SQLModel):
    record: Record


class VocabulariesOutput(SQLModel):
    vocabularies: List[Vocabulary]


class VocabularyOutput(SQLModel):
    vocabulary: Vocabulary


class ConceptsOutput(SQLModel):
    concepts: List[Concept]


class ConceptOutput(SQLModel):
    concept: Concept
