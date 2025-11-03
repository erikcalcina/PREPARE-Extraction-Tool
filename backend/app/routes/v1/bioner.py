import requests
from typing import List
from sqlmodel import Session, select
from fastapi import APIRouter, HTTPException, Depends, status

from app.models import MessageOutput
from app.core.database import get_db
from app.core.settings import settings
from app.models_db import Record, SourceTerm
from app.interfaces import NERRequest, Entity, LabelsInput

router = APIRouter(tags=["BioNER"])

@router.post("/extract", response_model=List[Entity])
def extract_entities(
        request: NERRequest
):
    """
    Extract named entities from medical text using the BioNER service.
    """
    try:
        response = requests.post(
            f"{settings.BIONER_SERVICE_URL}/ner",
            json=request.dict(),
            timeout=300
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"BioNER service error: {str(e)}"
        )
    
@router.post("/{dataset_id}/records/{record_id}/extract", response_model=MessageOutput)
def extract_entities_from_record(
    dataset_id: int,
    record_id: int,
    labels: LabelsInput,
    db: Session = Depends(get_db)
):
    """
    Extract named entities from a record's text and save them as source terms.
    """
    statement = (
        select(Record)
        .where(Record.id == record_id)
        .where(Record.dataset_id == dataset_id)
    )
    record = db.exec(statement).one_or_none()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found in this dataset"
        )
    
    request_data = {
        "medical_text": record.text,
        "labels": labels.labels
    }
    
    try:
        response = requests.post(
            f"{settings.BIONER_SERVICE_URL}/ner",
            json=request_data,
            timeout=300
        )
        response.raise_for_status()
        entities = response.json()
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"BioNER service error: {str(e)}"
        )
    # Save entities as source terms 
    source_terms = [
        SourceTerm(
            record_id=record_id,
            value=entity["text"],
            label=entity["label"]
        )
        for entity in entities
    ]
    db.add_all(source_terms)
    db.commit()
    
    return MessageOutput(
        message=f"Extracted and saved {len(source_terms)} entities from record {record_id}"
    )
