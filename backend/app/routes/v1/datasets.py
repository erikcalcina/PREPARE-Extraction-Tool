from fastapi import APIRouter
from typing import List
import io
import csv
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.models import DatasetCreate, MessageOutput, RecordCreate
from app.core.database import get_db
from fastapi import APIRouter, HTTPException, Depends
from app.models_db import Dataset, Record
from sqlmodel import select, Session


router = APIRouter(tags=["Datasets"])


# DATASETS

@router.post("/", response_model=MessageOutput, status_code=201)
def create_dataset(dataset: DatasetCreate, db: Session = Depends(get_db)):
    """
    Dobi JSON, ki se ujema z modelom Dataset.
    {
        "dataset_name": "Test dataset",
        "dataset_labels": ["label1", "label2"],
        "records": []
    }
    Nato pretvori to v objekt Dataset.
    """
    # Shrani dataset v bazo
    db_dataset = Dataset(
        dataset_name=dataset.dataset_name,
        dataset_labels=dataset.dataset_labels
    )
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset) # refresh da dobim ustvarjen id

    # Shrani vse records v svojo bazo
    for r in dataset.records:
        db_record = Record(
            record_text=r.record_text,
            record_dataset_id=db_dataset.dataset_id
        )
        db.add(db_record)
    db.commit()

    return {"message": "Dataset created"}

@router.get("/", response_model=List[Dataset])
def get_datasets(db: Session = Depends(get_db)):
    """
    Vrne vse datasete.
    """
    datasets = db.exec(select(Dataset)).all()  
    return datasets

@router.get("/{dataset_id}", response_model=Dataset)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return dataset

@router.delete("/{dataset_id}", response_model=MessageOutput)
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    db.delete(dataset)
    db.commit()
    # kaskadno brisanje, pobrišejo se tudi vsi records s tem id

    return {"message": "Dataset deleted"}

@router.get("/{dataset_id}/download", response_class=StreamingResponse)
def download_dataset_csv(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    records = dataset.records
    if not records:
        raise HTTPException(status_code=404, detail="No records found for this dataset")

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["text"])
    for record in records:
        writer.writerow([record.record_text])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={dataset.dataset_name}.csv"}
    )


# RECORDS

@router.post("/{dataset_id}/records", response_model=MessageOutput, status_code=201)
def add_record(dataset_id: int, record: RecordCreate, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    record_db = Record(
        record_text=record.record_text,
        record_dataset_id=dataset_id
    )
    db.add(record_db)
    db.commit()
    db.refresh(record_db)

    return {"message": "Record added"}

@router.get("/{dataset_id}/records", response_model=List[Record])
def get_records(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return dataset.records

@router.get("/{dataset_id}/records/{record_id}", response_model=Record)
def get_record(dataset_id: int, record_id: int, db: Session = Depends(get_db)):
    statement = (
        select(Record)
        .where(Record.record_dataset_id == dataset_id)
        .where(Record.record_id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")   
    
    return record

@router.delete("/{dataset_id}/records/{record_id}", response_model=MessageOutput)
def delete_record(dataset_id: int, record_id: int, db: Session = Depends(get_db)):
    statement = (
        select(Record)
        .where(Record.record_dataset_id == dataset_id)
        .where(Record.record_id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    
    db.delete(record)
    db.commit()

    return {"message": "Record deleted"}

@router.put("/{dataset_id}/records/{record_id}", response_model=MessageOutput)
def update_record(dataset_id: int, record_id: int, record: RecordCreate, db: Session = Depends(get_db)):
    statement = (
        select(Record)
        .where(Record.record_dataset_id == dataset_id)
        .where(Record.record_id == record_id)
    )
    db_record = db.exec(statement).one_or_none()

    if db_record is None:
        raise HTTPException(status_code=404, detail="Record not found")   
    
    db_record.record_text = record.record_text
    db.commit()

    return {"message": "Record updated"}
