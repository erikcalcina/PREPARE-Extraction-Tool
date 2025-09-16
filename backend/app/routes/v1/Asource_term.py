import io
import csv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from fastapi.responses import StreamingResponse
from app.models import SourceTerm
from app.library.source_term_service import SourceTermService

router = APIRouter(
    tags=["Source Term"]
)

service = SourceTermService()

@router.post("/", status_code=201)
async def create_source_term(term: SourceTerm):
    return service.create(term)

@router.get("/download")
async def download_source_terms_csv():
    return service.download_csv()

@router.get("/", response_model=List[SourceTerm])
async def get_source_terms():
    return service.get_all()

@router.get("/{term_id}", response_model=SourceTerm)
async def get_source_term(term_id: str):
    return service.get_by_id(term_id)

@router.delete("/{term_id}", status_code=204)
async def delete_source_term(term_id: str):
    service.delete(term_id)
