# app/tests/test_datasets.py

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routes.v1.datasets import router  
from app.utils.fake_db import fake_datasets_db

app = FastAPI()
app.include_router(router)

client = TestClient(app)

@pytest.fixture(autouse=True)
def clear_db():
    fake_datasets_db.clear()
    yield
    fake_datasets_db.clear()

def test_create_dataset():
    response = client.post("/api/v1/datasets", json={
        "dataset_id": "d1",
        "dataset_name": "Test Dataset",
        "records": []
    })
    assert response.status_code == 201

def test_get_datasets():
    client.post("/api/v1/datasets", json={
        "dataset_id": "d1",
        "dataset_name": "Test Dataset",
        "records": []
    })
    response = client.get("/api/v1/datasets")
    assert response.status_code == 200

def test_get_specific_dataset():
    client.post("/api/v1/datasets", json={
        "dataset_id": "d1",
        "dataset_name": "Test Dataset",
        "records": []
    })
    response = client.get("/api/v1/datasets/d1")
    assert response.status_code == 200

def test_add_record():
    client.post("/api/v1/datasets", json={
        "dataset_id": "d1",
        "dataset_name": "Test Dataset",
        "records": []
    })
    response = client.post("/api/v1/datasets/d1/records", json={
        "record_id": "r1",
        "data": {"field1": "value1"}
    })
    assert response.status_code == 201

def test_get_records():
    client.post("/api/v1/datasets", json={
        "dataset_id": "d1",
        "dataset_name": "Test Dataset",
        "records": []
    })
    client.post("/api/v1/datasets/d1/records", json={
        "record_id": "r1",
        "data": {"field1": "value1"}
    })
    response = client.get("/api/v1/datasets/d1/records")
    assert response.status_code == 200

def test_delete_record():
    client.post("/api/v1/datasets", json={
        "dataset_id": "d1",
        "dataset_name": "Test Dataset",
        "records": []
    })
    client.post("/api/v1/datasets/d1/records", json={
        "record_id": "r1",
        "data": {"field1": "value1"}
    })
    response = client.delete("/api/v1/datasets/d1/records/r1")
    assert response.status_code == 204

def test_delete_dataset():
    client.post("/api/v1/datasets", json={
        "dataset_id": "d1",
        "dataset_name": "Test Dataset",
        "records": []
    })
    response = client.delete("/api/v1/datasets/d1")
    assert response.status_code == 204

def test_download_dataset_csv():
    dataset = {
        "dataset_id": "ds1",
        "dataset_name": "Test Dataset",
        "records": [
            {"record_id": "r1", "data": {"field1": "value1", "field2": "value2"}, "extract": None},
            {"record_id": "r2", "data": {"field1": "value3", "field2": "value4"}, "extract": None},
        ]
    }
    fake_datasets_db.append(dataset)
    response = client.get("/api/v1/datasets/ds1/download")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"

def test_download_dataset_not_found():
    response = client.get("/api/v1/datasets/nonexistent/download")
    assert response.status_code == 404
    assert response.json() == {"detail": "Dataset not found"}

def test_download_dataset_no_records():
    dataset = {
        "dataset_id": "empty_ds",
        "dataset_name": "Empty Dataset",
        "records": []
    }
    fake_datasets_db.append(dataset)
    response = client.get("/api/v1/datasets/empty_ds/download")
    assert response.status_code == 400
    assert response.json() == {"detail": "No records found in dataset"}