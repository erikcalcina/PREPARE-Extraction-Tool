from fastapi.testclient import TestClient
from app.main import app
from app.utils.fake_db import reset_fake_db, fake_source_terms_db

client = TestClient(app)

def setup_function():
    reset_fake_db()

def test_create_source_term():
    response = client.post("/api/v1/source_terms", json={
        "term_id": "st1",
        "term_name": "Diabetes"
    })
    assert response.status_code == 201
    assert response.json()["term_id"] == "st1"
    assert response.json()["term_name"] == "Diabetes"

def test_create_duplicate_source_term():
    client.post("/api/v1/source_terms", json={"term_id": "st1", "term_name": "Diabetes"})
    response = client.post("/api/v1/source_terms", json={"term_id": "st1", "term_name": "Diabetes"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Term already exists"

def test_get_all_source_terms():
    client.post("/api/v1/source_terms", json={"term_id": "st1", "term_name": "Diabetes"})
    response = client.get("/api/v1/source_terms")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["term_id"] == "st1"

def test_delete_source_term():
    client.post("/api/v1/source_terms", json={"term_id": "st1", "term_name": "Diabetes"})
    response = client.delete("/api/v1/source_terms/st1")
    assert response.status_code == 204

def test_delete_nonexistent_term():
    response = client.delete("/api/v1/source_terms/not_exist")
    assert response.status_code == 404
    assert response.json()["detail"] == "Term not found"

def test_download_source_terms():
    client.post("/api/v1/source_terms", json={"term_id": "st1", "term_name": "Diabetes"})
    response = client.get("/api/v1/source_terms/download")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert b"term_id,term_name,description" in response.content
    assert b"st1,Diabetes" in response.content

