from pydantic import BaseModel
from typing import Optional, List, TypedDict

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

class MessageOutput(TypedDict):
    message: str

class SourceTerm(BaseModel):
    term_id: str
    term_name: str
    description: Optional[str] = None

class Concept(BaseModel):
    id: str
    name: str

class Vocabulary(BaseModel):
    id: str
    name: str
    concepts: Optional[List[Concept]] = []

class VocabularyInput(BaseModel):
    id: str
    name: str

class ConceptInput(BaseModel):
    id: str
    name: str

class RecordExtract(BaseModel):
    extracted_data: Optional[str] = None

class Record(BaseModel):
    record_id: str
    data: dict
    extract: Optional[RecordExtract] = None

class Dataset(BaseModel):
    dataset_id: str
    dataset_name: str
    records: List[Record] = []