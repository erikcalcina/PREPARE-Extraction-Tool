from typing import Optional, List
from pydantic import BaseModel

fake_users_db = {
    "admin": {
        "username": "admin",
        "password": "1234"
    }
}

fake_vocabularies_db = []

uploaded_filenames = []

fake_source_terms_db = []

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

fake_datasets_db = [
    Dataset(dataset_id="1", dataset_name="test1 Vocabulary", records=[]),
    Dataset(dataset_id="2", dataset_name="test2 Expressions", records=[]),
]

def reset_fake_db():
    global fake_users_db, fake_vocabularies_db, uploaded_filenames, fake_datasets_db, fake_source_terms_db
    fake_users_db = {
        "admin": {
            "username": "admin",
            "password": "1234"
        }
    }
    fake_vocabularies_db = []
    uploaded_filenames = []
    fake_source_terms_db = []
    fake_datasets_db = [
        Dataset(dataset_id="1", dataset_name="Arabic Vocabulary", records=[]),
        Dataset(dataset_id="2", dataset_name="English Expressions", records=[]),
    ]
