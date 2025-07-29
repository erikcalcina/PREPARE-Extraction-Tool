import io
import csv
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.utils.fake_db import fake_datasets_db
from app.models import Dataset, Record, RecordExtract

class DatasetService:
    def __init__(self, db):
        self.db = db

    def create_dataset(self, dataset: Dataset):
        for d in self.db:
            if d["dataset_id"] == dataset.dataset_id:
                raise HTTPException(status_code=400, detail="Dataset already exists")
        self.db.append(dataset.model_dump())
        return dataset

#TODO:The get dataset should be based on the user ID. In the future, the request should filter based on the user ID before returning.
    def get_datasets(self):
        return self.db

    def get_dataset(self, dataset_id: str):
        for d in self.db:
            if d["dataset_id"] == dataset_id:
                return d
        raise HTTPException(status_code=404, detail="Dataset not found")

    def delete_dataset(self, dataset_id: str):
        for d in self.db:
            if d["dataset_id"] == dataset_id:
                self.db.remove(d)
                return
        raise HTTPException(status_code=404, detail="Dataset not found")

    def add_record(self, dataset_id: str, record: Record):
        for d in self.db:
            if d["dataset_id"] == dataset_id:
                for r in d["records"]:
                    if r["record_id"] == record.record_id:
                        raise HTTPException(status_code=400, detail="Record already exists")
                d["records"].append(record.model_dump())
                return record
        raise HTTPException(status_code=404, detail="Dataset not found")

    def get_records(self, dataset_id: str):
        return self.get_dataset(dataset_id)["records"]

    def delete_record(self, dataset_id: str, record_id: str):
        dataset = self.get_dataset(dataset_id)
        for r in dataset["records"]:
            if r["record_id"] == record_id:
                dataset["records"].remove(r)
                return
        raise HTTPException(status_code=404, detail="Record not found")

    def get_record_by_id(self, dataset_id: str, record_id: str):
        dataset = self.get_dataset(dataset_id)
        for r in dataset["records"]:
            if r["record_id"] == record_id:
                return r
        raise HTTPException(status_code=404, detail="Record not found")

    def update_record(self, dataset_id: str, record_id: str, updated_record: Record):
        dataset = self.get_dataset(dataset_id)
        for i, r in enumerate(dataset["records"]):
            if r["record_id"] == record_id:
                dataset["records"][i] = updated_record.model_dump()
                return {"message": "Record updated"}
        raise HTTPException(status_code=404, detail="Record not found")

    def get_all_extracts(self, dataset_id: str):
        return [r.get("extract") for r in self.get_dataset(dataset_id)["records"]]

    def update_all_extracts(self, dataset_id: str, extract: RecordExtract):
        dataset = self.get_dataset(dataset_id)
        for r in dataset["records"]:
            r["extract"] = extract.model_dump()
        return {"message": "All extracts updated"}

    def delete_all_extracts(self, dataset_id: str):
        dataset = self.get_dataset(dataset_id)
        for r in dataset["records"]:
            r["extract"] = None
        return {"message": "All extracts deleted"}

    def get_extract(self, dataset_id: str, record_id: str):
        return self.get_record_by_id(dataset_id, record_id).get("extract")

    def update_extract(self, dataset_id: str, record_id: str, extract: RecordExtract):
        record = self.get_record_by_id(dataset_id, record_id)
        record["extract"] = extract.model_dump()
        return {"message": "Extract updated"}

    def delete_extract(self, dataset_id: str, record_id: str):
        record = self.get_record_by_id(dataset_id, record_id)
        record["extract"] = None
        return {"message": "Extract deleted"}

    def download_dataset_csv(self, dataset_id: str):
        dataset = self.get_dataset(dataset_id)
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

#TODO: This part will move from here to anothe file(example==>dataset_sevice.py)
service = DatasetService(fake_datasets_db)
router = APIRouter(prefix="/api/v1/datasets", tags=["Datasets"])

router.post("/")(service.create_dataset)
router.get("/")(service.get_datasets)
router.get("/{dataset_id}")(service.get_dataset)
router.delete("/{dataset_id}")(service.delete_dataset)
router.post("/{dataset_id}/records")(service.add_record)
router.get("/{dataset_id}/records")(service.get_records)
router.delete("/{dataset_id}/records/{record_id}")(service.delete_record)
router.get("/{dataset_id}/records/{record_id}")(service.get_record_by_id)
router.put("/{dataset_id}/records/{record_id}")(service.update_record)
router.get("/{dataset_id}/records/extract")(service.get_all_extracts)
router.post("/{dataset_id}/records/extract")(service.update_all_extracts)
router.delete("/{dataset_id}/records/extract")(service.delete_all_extracts)
router.get("/{dataset_id}/records/{record_id}/extract")(service.get_extract)
router.post("/{dataset_id}/records/{record_id}/extract")(service.update_extract)
router.delete("/{dataset_id}/records/{record_id}/extract")(service.delete_extract)
router.get("/{dataset_id}/download")(service.download_dataset_csv)