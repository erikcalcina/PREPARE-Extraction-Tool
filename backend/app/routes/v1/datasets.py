import csv
import io
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.core.database import get_session, Dataset, Record
from app.models import (
    DatasetCreate,
    DatasetsOutput,
    DatasetOutput,
    RecordsOutput,
    RecordCreate,
    RecordOutput,
    MessageOutput,
)

# ================================================
# Route definitions
# ================================================

router = APIRouter()

# ================================================
# Datasets routes
# ================================================


@router.get(
    "/",
    response_model=DatasetsOutput,
    status_code=status.HTTP_200_OK,
    summary="List all datasets",
    description="Retrieves a list of all datasets in the system",
    response_description="List of datasets with their metadata",
)
def get_datasets(db: Session = Depends(get_session)):
    datasets = db.exec(select(Dataset)).all()
    return DatasetsOutput(datasets=datasets)


@router.post(
    "/",
    response_model=MessageOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new dataset",
    description="Creates a new dataset with its associated records",
    response_description="Confirmation message that the dataset was created successfully",
)
def create_dataset(
    name: str = Form(...),
    labels: str = Form(...),    # sent as "name,age,location"
    file: UploadFile = File(...), 
    db: Session = Depends(get_session)
):
    record_list = parse_file(file)

    label_list = [label for label in labels.split(",")]
    dataset = Dataset(name=name, labels=label_list)
    db.add(dataset)
    db.commit()
    # Refresh the instance so database now has its generated ID
    db.refresh(dataset)

    for r in record_list:
        record = Record(text=r.text, dataset_id=dataset.id)
        db.add(record)
    db.flush()

    return MessageOutput(message="Dataset created successfully")

async def parse_file(file: UploadFile) -> List[str]:
    """Parse a file into a list of records."""
    raw = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".csv"):
        import csv
        try:
            reader = csv.reader(io.StringIO(raw.decode("utf-8")))
            if reader.fieldnames is None or "text" not in reader.fieldnames:
                raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"CSV must have a 'text' column."
            )

            records = [row["text"] for row in reader if row.get("text")]

        except Exception as e:
            raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse CSV: {e}"
        )

    elif filename.endswith(".json"):
        import json
        try:
            data = json.loads(raw)
            if not isinstance(data, list):
                raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"JSON file must be a list of records."
            )
            
            records = [
                r["text"]
                for r in data
                if isinstance(r.get("text"), str) and r.get("text").strip()
            ]

        except Exception as e:
            raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse JSON: {e}"
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type."
        )
    
    return records

@router.get(
    "/{dataset_id}",
    response_model=DatasetOutput,
    status_code=status.HTTP_200_OK,
    summary="Get a specific dataset",
    description="Retrieves a single dataset by its ID",
    response_description="The requested dataset with its metadata",
)
def get_dataset(dataset_id: int, db: Session = Depends(get_session)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    return DatasetOutput(dataset=dataset)


@router.delete(
    "/{dataset_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Delete a dataset",
    description="Deletes a dataset and all its associated records (cascade delete)",
    response_description="Confirmation message that the dataset was deleted successfully",
)
def delete_dataset(dataset_id: int, db: Session = Depends(get_session)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )

    db.delete(dataset)
    db.commit()
    # Cascade delete – also deletes all records linked to this dataset

    return MessageOutput(message="Dataset deleted successfully")


@router.get(
    "/{dataset_id}/download",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
    summary="Download dataset",
    description="Downloads a dataset's records as a file",
    response_description="The file containing the dataset records",
)
def download_dataset(dataset_id: int, format: str ="csv", db: Session = Depends(get_session)):
    # TODO: enable dataset download as JSON or CSV (?format=json or ?format=csv, where csv is the default)

    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )

    records = dataset.records
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No records found for this dataset",
        )

    # TODO: make a separate function for this
    # FIX: the solution below does not parse the text correctly. There should be
    #      one column containing the whole text (parsed accordingly) - newlines
    #      should be properly handled (i.e. "Text text\n\ntext text" in a single line).
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["text"])
    for record in records:
        # TODO: add other fields (extracted, clusters, etc.)
        writer.writerow([record.text])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={dataset.name}.csv"},
    )


# ================================================
# Dataset records routes
# ================================================


@router.post(
    "/{dataset_id}/records",
    response_model=MessageOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Add a record to a dataset",
    description="Creates a new record and adds it to the specified dataset",
    response_description="Confirmation message that the record was added successfully",
)
def add_record(
    dataset_id: int, record: RecordCreate, db: Session = Depends(get_session)
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )

    record = Record(text=record.text, dataset_id=dataset_id)
    db.add(record)
    db.commit()
    db.refresh(record)

    return MessageOutput(message="Record added successfully")


@router.get(
    "/{dataset_id}/records",
    response_model=RecordsOutput,
    status_code=status.HTTP_200_OK,
    summary="List all records in a dataset",
    description="Retrieves all records belonging to a specific dataset",
    response_description="List of records in the dataset",
)
def get_records(dataset_id: int, db: Session = Depends(get_session)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )

    return RecordsOutput(records=dataset.records)


@router.get(
    "/{dataset_id}/records/{record_id}",
    response_model=RecordOutput,
    status_code=status.HTTP_200_OK,
    summary="Get a specific record",
    description="Retrieves a single record by its ID from a specific dataset",
    response_description="The requested record",
)
def get_record(dataset_id: int, record_id: int, db: Session = Depends(get_session)):
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    return RecordOutput(record=record)


@router.put(
    "/{dataset_id}/records/{record_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Update a record",
    description="Updates the text content of a specific record in a dataset",
    response_description="Confirmation message that the record was updated successfully",
)
def update_record(
    dataset_id: int,
    record_id: int,
    record: RecordCreate,
    db: Session = Depends(get_session),
):
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    db_record = db.exec(statement).one_or_none()

    if db_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    db_record.text = record.text
    db.commit()

    return MessageOutput(message="Record updated successfully")


@router.delete(
    "/{dataset_id}/records/{record_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Delete a record",
    description="Deletes a specific record from a dataset",
    response_description="Confirmation message that the record was deleted successfully",
)
def delete_record(dataset_id: int, record_id: int, db: Session = Depends(get_session)):
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    db.delete(record)
    db.commit()

    return MessageOutput(message="Record deleted successfully")
