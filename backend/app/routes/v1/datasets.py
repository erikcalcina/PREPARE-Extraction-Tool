from fastapi import APIRouter
from app.utils.fake_db import fake_datasets_db
from app.library.dataset_service import DatasetService

router = APIRouter(tags=["Datasets"])

service = DatasetService(fake_datasets_db)

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
