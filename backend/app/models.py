from pydantic import BaseModel
from typing import Optional, TypedDict, List

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

class SourceTermService:
    def __init__(self, db):
        self.db = db

    def create(self, term: SourceTerm):
        for t in self.db:
            if t["term_id"] == term.term_id:
                raise HTTPException(status_code=400, detail="Term already exists")
        self.db.append(term.model_dump())
        return term

    def get_all(self) -> List[SourceTerm]:
        return self.db

    def get_by_id(self, term_id: str) -> SourceTerm:
        for t in self.db:
            if t["term_id"] == term_id:
                return t
        raise HTTPException(status_code=404, detail="Term not found")

    def delete(self, term_id: str):
        for t in self.db:
            if t["term_id"] == term_id:
                self.db.remove(t)
                return
        raise HTTPException(status_code=404, detail="Term not found")

    def download_csv(self):
        if not self.db:
            raise HTTPException(status_code=400, detail="No source terms to download")
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["term_id", "term_name", "description"])
        writer.writeheader()
        for term in self.db:
            writer.writerow(term)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=source_terms.csv"}
        )