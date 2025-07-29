import io
import csv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from fastapi.responses import StreamingResponse
from app.utils.fake_db import fake_source_terms_db
from app.models import SourceTerm, SourceTermService

router = APIRouter(
    prefix="/api/v1/source_term",
    tags=["Source Term"]
)


service = SourceTermService(fake_source_terms_db)


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
