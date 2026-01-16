import requests
from typing import List
from sqlmodel import Session, select
from fastapi import APIRouter, HTTPException, Depends, status

from app.core.settings import settings
from app.core.database import get_session, User, Dataset
from app.models_db import Record, SourceTerm
from app.schemas import MessageOutput
from app.routes.v1.auth import get_current_user

from app.interfaces import NERRequest, Entity, LabelsInput

router = APIRouter(tags=["BioNER"])


@router.post("/extract", response_model=List[Entity])
def extract_entities(
    request: NERRequest,
):
    """
    Extract named entities from medical text using the BioNER service.
    """

    # TODO: Must not allow it to be accessible without authentication
    try:
        response = requests.post(
            f"{settings.EXTRACT_HOST}/ner", json=request.dict(), timeout=300
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Extract service unavailable",
        )


@router.post("/{dataset_id}/records/{record_id}/extract", response_model=MessageOutput)
def extract_entities_from_record(
    dataset_id: int,
    record_id: int,
    labels: LabelsInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    # Verify dataset ownership
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    if dataset.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this dataset",
        )

    statement = (
        select(Record)
        .where(Record.id == record_id)
        .where(Record.dataset_id == dataset_id)
    )
    record = db.exec(statement).one_or_none()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found in this dataset",
        )

    # NEW: skip extraction on reviewed records
    if record.reviewed:
        return MessageOutput(
            message=f"Record {record_id} is reviewed; extraction skipped"
        )

    request_data = {"medical_text": record.text, "labels": labels.labels}

    try:
        response = requests.post(
            f"{settings.EXTRACT_HOST}/ner", json=request_data, timeout=300
        )
        response.raise_for_status()
        entities = response.json()
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Extraction service unavailable",
        )

    existing_keys = {
        (t.value, t.label, t.start_position, t.end_position)
        for t in db.exec(
            select(SourceTerm).where(SourceTerm.record_id == record_id)
        ).all()
    }
    new_terms = []
    for entity in entities:
        key = (
            entity["text"],
            entity["label"],
            entity["start"],
            entity["end"],
        )
        if key in existing_keys:
            continue
        existing_keys.add(key)
        new_terms.append(
            SourceTerm(
                record_id=record_id,
                value=entity["text"],
                label=entity["label"],
                start_position=entity["start"],
                end_position=entity["end"],
                score=entity["score"],
                automatically_extracted=True,
            )
        )

    if new_terms:
        db.add_all(new_terms)
        db.commit()

    return MessageOutput(
        message=f"Extracted and saved {len(new_terms)} entities from record {record_id}"
    )


@router.post("/{dataset_id}/records/extract", response_model=MessageOutput)
def extract_entities_from_records(
    dataset_id: int,
    labels: LabelsInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Extract named entities from every record in the dataset and save them as source terms.
    """
    # Verify dataset ownership
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    if dataset.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this dataset",
        )

    statement = select(Record).where(Record.dataset_id == dataset_id)
    records = db.exec(statement).all()
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No records found for this dataset",
        )

    source_terms: List[SourceTerm] = []
    for record in records:
        # NEW: skip reviewed records
        if record.reviewed:
            continue

        request_data = {"medical_text": record.text, "labels": labels.labels}
        try:
            response = requests.post(
                f"{settings.EXTRACT_HOST}/ner", json=request_data, timeout=300
            )
            response.raise_for_status()
            entities = response.json()
        except requests.RequestException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Extraction service unavailable",
            )

        # NEW: avoid duplicates per record
        existing_keys = {
            (t.value, t.label, t.start_position, t.end_position)
            for t in db.exec(
                select(SourceTerm).where(SourceTerm.record_id == record.id)
            ).all()
        }
        for entity in entities:
            key = (
                entity["text"],
                entity["label"],
                entity["start"],
                entity["end"],
            )
            if key in existing_keys:
                continue
            existing_keys.add(key)
            source_terms.append(
                SourceTerm(
                    record_id=record.id,
                    value=entity["text"],
                    label=entity["label"],
                    start_position=entity["start"],
                    end_position=entity["end"],
                    score=entity["score"],
                    automatically_extracted=True,
                )
            )

    if source_terms:
        db.add_all(source_terms)
        db.commit()

    return MessageOutput(
        message=f"Extracted and saved {len(source_terms)} entities from dataset {dataset_id}"
    )
