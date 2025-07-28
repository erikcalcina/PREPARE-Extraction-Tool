import io
import csv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from fastapi.responses import StreamingResponse
from app.utils.fake_db import fake_source_terms_db  

router = APIRouter(
    prefix="/api/v1/source_terms",
    tags=["Source Terms"]
)
class SourceTerm(BaseModel):
    term_id: str
    term_name: str
    description: Optional[str] = None
@router.post("/", status_code=201)
async def create_source_term(term: SourceTerm):
    for t in fake_source_terms_db:
        if t["term_id"] == term.term_id:
            raise HTTPException(status_code=400, detail="Term already exists")
    fake_source_terms_db.append(term.model_dump())
    return term
#TODO: this dataset just word(from json) we need to change this to file 
@router.get("/download")
async def download_source_terms_csv():
    if not fake_source_terms_db:
        raise HTTPException(status_code=400, detail="No source terms to download")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["term_id", "term_name", "description"])
    writer.writeheader()
    for term in fake_source_terms_db:
        writer.writerow(term)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",  
        headers={"Content-Disposition": "attachment; filename=source_terms.csv"}
    )

@router.get("/", response_model=List[SourceTerm])
async def get_source_terms():
    return fake_source_terms_db

@router.get("/{term_id}", response_model=SourceTerm)
async def get_source_term(term_id: str):
    for t in fake_source_terms_db:
        if t["term_id"] == term_id:
            return t
    raise HTTPException(status_code=404, detail="Term not found")

@router.delete("/{term_id}", status_code=204)
async def delete_source_term(term_id: str):
    for t in fake_source_terms_db:
        if t["term_id"] == term_id:
            fake_source_terms_db.remove(t)
            return
    raise HTTPException(status_code=404, detail="Term not found")
