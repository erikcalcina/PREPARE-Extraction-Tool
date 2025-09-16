import io
import csv
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from fastapi.responses import StreamingResponse
from app.models import SourceTermCreate, MessageOutput
from app.models_db import SourceTerm, Record, Concept
from app.core.database import get_db
from sqlmodel import select, Session


router = APIRouter(tags=["Source Term"])


@router.post("/{record_id}", response_model=MessageOutput, status_code=201)
def create_source_term(record_id: int, term: SourceTermCreate, db: Session = Depends(get_db)):
    record = db.get(Record, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")  
      
    term_db = SourceTerm(
        record_id=record_id,
        term_value=term.term_value,
        term_label=term.term_label
    )
    db.add(term_db)
    db.commit()
    return {"message": "Source term created"}

@router.get("/{record_id}", response_model=List[SourceTerm])
def get_source_terms(record_id: int, db: Session = Depends(get_db)):
    record = db.get(Record, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return record.source_terms

@router.get("{record_id}/{term_id}", response_model=SourceTerm)
def get_source_term(record_id: int, term_id: str, db: Session = Depends(get_db)):
    statement = (
        select(SourceTerm)
        .where(SourceTerm.term_id == term_id)
        .where(SourceTerm.record_id == record_id)
    )
    term_db = db.exec(statement).one_or_none()

    if term_db is None:
        raise HTTPException(status_code=404, detail="Source term not found")   
    
    return term_db

@router.delete("{record_id}/{term_id}", response_model=MessageOutput)
def delete_source_term(record_id: int, term_id: str, db: Session = Depends(get_db)):
    statement = (
        select(SourceTerm)
        .where(SourceTerm.term_id == term_id)
        .where(SourceTerm.record_id == record_id)
    )
    term_db = db.exec(statement).one_or_none()

    if term_db is None:
        raise HTTPException(status_code=404, detail="Source term not found")     
    db.delete(term_db)
    db.commit()

    return {"message": "Source term deleted"}

@router.put("{term_id}/alternative/{alternative_id}", response_model=MessageOutput)
def add_alternative(term_id: int, alternative_id: int, db: Session = Depends(get_db)):
    term_db = db.get(SourceTerm, term_id)
    if term_db is None:
        raise HTTPException(status_code=404, detail="Source term not found")   
    
    alt_db = db.get(SourceTerm, alternative_id)
    if alt_db is None:
        raise HTTPException(status_code=404, detail="Alternative term not found")   
    
    term_db.alternative_id = alternative_id
    db.commit()

    return {"message": "Source term alternative updated"}

# @router.get("/download", response_model=StreamingResponse)
# def download_source_terms_csv(db: Session = Depends(get_db)):
#     pass

@router.get("/{term_id}/map", response_model=list[Concept])
def map_term_to_concept(term_id: int, db: Session = Depends(get_db)):
    """Map the source term to the vocabulary concepts"""

    term_db = db.get(SourceTerm, term_id)
    if term_db is None:
        raise HTTPException(status_code=404, detail="Source term not found")

    concepts = [m.concept for m in term_db.mappings if m.concept is not None]

    return concepts