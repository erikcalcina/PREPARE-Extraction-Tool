import io
import csv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from fastapi.responses import StreamingResponse
from app.utils.fake_db import fake_datasets_db

router = APIRouter(
    prefix="/api/v1/datasets",
    tags=["Datasets"]
)
# Models for requests and responses
class RecordExtract(BaseModel):
    extracted_data: Optional[str] = None
class Record(BaseModel):
    record_id: str
    data: dict  
    extract: Optional[RecordExtract] = None
class Dataset(BaseModel):
    dataset_id: str
    dataset_name: str
    records: List[Record] = []
# POST /api/v1/datasets : Create dataset
@router.post("/", status_code=201)
async def create_dataset(dataset: Dataset):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset.dataset_id:
            raise HTTPException(status_code=400, detail="Dataset already exists")
    fake_datasets_db.append(dataset.model_dump())
    return dataset
# GET /api/v1/datasets : List all datasets
@router.get("/")
async def get_datasets():
    return fake_datasets_db
# GET /api/v1/datasets/{dataset_id} : Get specific dataset by id
@router.get("/{dataset_id}")
async def get_dataset(dataset_id: str):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            return d
    raise HTTPException(status_code=404, detail="Dataset not found")
# DELETE /api/v1/datasets/{dataset_id} : Delete dataset by id
@router.delete("/{dataset_id}", status_code=204)
async def delete_dataset(dataset_id: str):
    global fake_datasets_db
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            fake_datasets_db.remove(d)
            return
    raise HTTPException(status_code=404, detail="Dataset not found")
# POST /api/v1/datasets/{dataset_id}/records : Add record to dataset
@router.post("/{dataset_id}/records", status_code=201)
async def add_record(dataset_id: str, record: Record):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            for r in d["records"]:
                if r["record_id"] == record.record_id:
                    raise HTTPException(status_code=400, detail="Record already exists")
            d["records"].append(record.model_dump())
            return record
    raise HTTPException(status_code=404, detail="Dataset not found")
# GET /api/v1/datasets/{dataset_id}/records : List records in dataset
@router.get("/{dataset_id}/records")
async def get_records(dataset_id: str):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            return d["records"]
    raise HTTPException(status_code=404, detail="Dataset not found")
# DELETE /api/v1/datasets/{dataset_id}/records/{record_id} : Delete a record
@router.delete("/{dataset_id}/records/{record_id}", status_code=204)
async def delete_record(dataset_id: str, record_id: str):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            for r in d["records"]:
                if r["record_id"] == record_id:
                    d["records"].remove(r)
                    return
            raise HTTPException(status_code=404, detail="Record not found")
    raise HTTPException(status_code=404, detail="Dataset not found")
# GET specific record
@router.get("/{dataset_id}/records/{record_id}")
async def get_record_by_id(dataset_id: str, record_id: str):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            for r in d["records"]:
                if r["record_id"] == record_id:
                    return r
            raise HTTPException(status_code=404, detail="Record not found")
    raise HTTPException(status_code=404, detail="Dataset not found")
# PUT update specific record
@router.put("/{dataset_id}/records/{record_id}")
async def update_record(dataset_id: str, record_id: str, updated_record: Record):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            for i, r in enumerate(d["records"]):
                if r["record_id"] == record_id:
                    d["records"][i] = updated_record.model_dump()
                    return {"message": "Record updated"}
            raise HTTPException(status_code=404, detail="Record not found")
    raise HTTPException(status_code=404, detail="Dataset not found")
# GET all extracts
@router.get("/{dataset_id}/records/extract")
async def get_all_extracts(dataset_id: str):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            return [r.get("extract") for r in d["records"]]
    raise HTTPException(status_code=404, detail="Dataset not found")
# POST all extracts
@router.post("/{dataset_id}/records/extract")
async def update_all_extracts(dataset_id: str, extract: RecordExtract):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            for r in d["records"]:
                r["extract"] = extract.model_dump()
            return {"message": "All extracts updated"}
    raise HTTPException(status_code=404, detail="Dataset not found")
# DELETE all extracts
@router.delete("/{dataset_id}/records/extract")
async def delete_all_extracts(dataset_id: str):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            for r in d["records"]:
                r["extract"] = None
            return {"message": "All extracts deleted"}
    raise HTTPException(status_code=404, detail="Dataset not found")
# GET extract for single record
@router.get("/{dataset_id}/records/{record_id}/extract")
async def get_extract(dataset_id: str, record_id: str):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            for r in d["records"]:
                if r["record_id"] == record_id:
                    return r.get("extract")
            raise HTTPException(status_code=404, detail="Record not found")
    raise HTTPException(status_code=404, detail="Dataset not found")
# POST extract for single record
@router.post("/{dataset_id}/records/{record_id}/extract")
async def update_extract(dataset_id: str, record_id: str, extract: RecordExtract):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            for r in d["records"]:
                if r["record_id"] == record_id:
                    r["extract"] = extract.model_dump()
                    return {"message": "Extract updated"}
            raise HTTPException(status_code=404, detail="Record not found")
    raise HTTPException(status_code=404, detail="Dataset not found")
# DELETE extract for single record
@router.delete("/{dataset_id}/records/{record_id}/extract")
async def delete_extract(dataset_id: str, record_id: str):
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            for r in d["records"]:
                if r["record_id"] == record_id:
                    r["extract"] = None
                    return {"message": "Extract deleted"}
            raise HTTPException(status_code=404, detail="Record not found")
    raise HTTPException(status_code=404, detail="Dataset not found")
#TODO: WE need to confirm this code for file but now we wite this for a normal data(as a word from json)
@router.get("/{dataset_id}/download")
async def download_dataset_csv(dataset_id: str):
    # find dataset from list
    dataset = None
    for d in fake_datasets_db:
        if d["dataset_id"] == dataset_id:
            dataset = d
            break
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    records = dataset.get("records", [])
    if not records:
        raise HTTPException(status_code=400, detail="No records found in dataset")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=records[0]["data"].keys())
    writer.writeheader()
    for record in records:
        writer.writerow(record["data"])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={dataset_id}.csv"}
    )