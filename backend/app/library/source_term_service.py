import io
import csv
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from app.models import SourceTerm



class SourceTermService:
    def __init__(self, db):
        self.db = db

    def create(self, term: SourceTerm):
        for t in self.db:
            if t["term_id"] == term.term_id:
                raise ValueError(status_code=400, detail="Term already exists")
        self.db.append(term.model_dump())
        return term

    def get_all(self) -> List[SourceTerm]:
        return self.db

    def get_by_id(self, term_id: str) -> SourceTerm:
        for t in self.db:
            if t["term_id"] == term_id:
                return t
        raise ValueError(status_code=404, detail="Term not found")

    def delete(self, term_id: str):
        for t in self.db:
            if t["term_id"] == term_id:
                self.db.remove(t)
                return
        raise ValueError(status_code=404, detail="Term not found")

    def download_csv(self):
        if not self.db:
            raise ValueError(status_code=400, detail="No source terms to download")
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
