from pydantic import BaseModel
from typing import Optional, TypedDict,List

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

class MessageOutput(TypedDict):
    message: str

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

class Record(BaseModel):
    id: str
    content: str

class Dataset(BaseModel):
    dataset_id: str
    dataset_name: str
    records: Optional[List[Record]] = []

class DatasetInput(BaseModel):
    dataset_id: str
    dataset_name: str
