from pydantic import BaseModel
from typing_extensions import List, TypedDict

class UserModel(BaseModel):
    user_name: str
    user_pass: str

class Config:
    from_attributes = True

class MessageOutput(TypedDict):
    message: str

class SourceTermCreate(BaseModel):
    term_value: str
    term_label: str

class ConceptCreate(BaseModel):
    vocab_term_id: str
    vocab_term_name: str

class VocabularyCreate(BaseModel):
    vocab_name: str
    vocab_version: str
    concepts: List[ConceptCreate] = []

class RecordCreate(BaseModel):
    record_text: str

class DatasetCreate(BaseModel):
    dataset_name: str
    dataset_labels: List[str] = []
    records: List[RecordCreate] = []