import csv
import io
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.core.database import get_session, Dataset, Record
from app.models import DatasetCreate, MessageOutput, RecordCreate

# ================================================
# Route definitions
# ================================================

router = APIRouter()

@router.post("/", response_model=MessageOutput, status_code=status.HTTP_201_CREATED)
def create_dataset(dataset: DatasetCreate, db: Session = Depends(get_session)):
    db_dataset = Dataset(
        name=dataset.name,
        labels=dataset.labels
    )
    db.add(db_dataset)
    db.commit()
    # Refresh the instance so db_dataset now has its generated ID
    db.refresh(db_dataset)

    for r in dataset.records:
        db_record = Record(
            text=r.text,
            dataset_id=db_dataset.id
        )
        db.add(db_record)
    db.commit()

    return MessageOutput(message="Dataset created")

@router.get("/", response_model=List[Dataset])
def get_datasets(db: Session = Depends(get_session)):
    datasets = db.exec(select(Dataset)).all()
    return datasets

@router.get("/{dataset_id}", response_model=Dataset)
def get_dataset(dataset_id: int, db: Session = Depends(get_session)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    return dataset

@router.delete("/{dataset_id}", response_model=MessageOutput)
def delete_dataset(dataset_id: int, db: Session = Depends(get_session)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    db.delete(dataset)
    db.commit()
    # Cascade delete – also deletes all records linked to this dataset

    return MessageOutput(message="Dataset deleted")

@router.get("/{dataset_id}/download", response_class=StreamingResponse)
def download_dataset_csv(dataset_id: int, db: Session = Depends(get_session)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    records = dataset.records
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No records found for this dataset")

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["text"])
    for record in records:
        writer.writerow([record.text])
    # TODO: add other fields (extracted, clusters, etc.)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={dataset.name}.csv"}
    )


# RECORDS

@router.post("/{dataset_id}/records", response_model=MessageOutput, status_code=status.HTTP_201_CREATED)
def add_record(dataset_id: int, record: RecordCreate, db: Session = Depends(get_session)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    record_db = Record(
        text=record.text,
        dataset_id=dataset_id
    )
    db.add(record_db)
    db.commit()
    db.refresh(record_db)

    return MessageOutput(message="Record added")

@router.get("/{dataset_id}/records", response_model=List[Record])
def get_records(dataset_id: int, db: Session = Depends(get_session)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    return dataset.records

@router.get("/{dataset_id}/records/{record_id}", response_model=Record)
def get_record(dataset_id: int, record_id: int, db: Session = Depends(get_session)):
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    return record

@router.delete("/{dataset_id}/records/{record_id}", response_model=MessageOutput)
def delete_record(dataset_id: int, record_id: int, db: Session = Depends(get_session)):
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()

    return MessageOutput(message="Record deleted")

@router.put("/{dataset_id}/records/{record_id}", response_model=MessageOutput)
def update_record(dataset_id: int, record_id: int, record: RecordCreate, db: Session = Depends(get_session)):
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    db_record = db.exec(statement).one_or_none()

    if db_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db_record.text = record.text
    db.commit()

    return MessageOutput(message="Record updated")