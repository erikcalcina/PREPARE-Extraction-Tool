from typing import List

from sqlmodel import SQLModel, Field


class UserModel(SQLModel):
    name: str
    password: str

class MessageOutput(SQLModel):
    message: str

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