import io
import csv
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.models import Dataset, Record, RecordExtract

class DatasetService:
    def __init__(self, db):
        self.db = db

    def create_dataset(self, dataset: Dataset):
        for d in self.db:
            if d["dataset_id"] == dataset.dataset_id:
                raise ValueError(status_code=400, detail="Dataset already exists")
        self.db.append(dataset.model_dump())
        return dataset

    def get_datasets(self):
        return self.db

    def get_dataset(self, dataset_id: str):
        for d in self.db:
            if d["dataset_id"] == dataset_id:
                return d
        raise ValueError(status_code=404, detail="Dataset not found")

    def delete_dataset(self, dataset_id: str):
        for d in self.db:
            if d["dataset_id"] == dataset_id:
                self.db.remove(d)
                return
        raise ValueError(status_code=404, detail="Dataset not found")

    def add_record(self, dataset_id: str, record: Record):
        for d in self.db:
            if d["dataset_id"] == dataset_id:
                for r in d["records"]:
                    if r["record_id"] == record.record_id:
                        raise ValueError(status_code=400, detail="Record already exists")
                d["records"].append(record.model_dump())
                return record
        raise ValueError(status_code=404, detail="Dataset not found")

    def get_records(self, dataset_id: str):
        return self.get_dataset(dataset_id)["records"]

    def delete_record(self, dataset_id: str, record_id: str):
        dataset = self.get_dataset(dataset_id)
        for r in dataset["records"]:
            if r["record_id"] == record_id:
                dataset["records"].remove(r)
                return
        raise ValueError(status_code=404, detail="Record not found")

    def get_record_by_id(self, dataset_id: str, record_id: str):
        dataset = self.get_dataset(dataset_id)
        for r in dataset["records"]:
            if r["record_id"] == record_id:
                return r
        raise ValueError(status_code=404, detail="Record not found")

    def update_record(self, dataset_id: str, record_id: str, updated_record: Record):
        dataset = self.get_dataset(dataset_id)
        for i, r in enumerate(dataset["records"]):
            if r["record_id"] == record_id:
                dataset["records"][i] = updated_record.model_dump()
                return {"message": "Record updated"}
        raise ValueError(status_code=404, detail="Record not found")

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
            raise ValueError(status_code=400, detail="No records found in dataset")
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
