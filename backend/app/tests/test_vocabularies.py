# from fastapi.testclient import TestClient
# from app.main import app

# client = TestClient(app)
# def test_create_vocabulary():
#     response = client.post("/api/v1/vocabularies", json={"id": "v1", "name": "Test Vocabulary"})
#     assert response.status_code == 201
#     assert response.json()["id"] == "v1"
#     assert response.json()["name"] == "Test Vocabulary"

# def test_get_vocabularies():
#     response = client.get("/api/v1/vocabularies")
#     assert response.status_code == 200
#     assert isinstance(response.json(), list)

# def test_get_specific_vocabulary():
#     response = client.get("/api/v1/vocabularies/v1")
#     assert response.status_code == 200
#     assert response.json()["name"] == "Test Vocabulary"

# def test_delete_vocabulary():
#     response = client.delete("/api/v1/vocabularies/v1")
#     assert response.status_code == 204

# def test_delete_nonexistent_vocabulary():
#     response = client.delete("/api/v1/vocabularies/nonexistent")
#     assert response.status_code == 404

# def test_create_vocabulary_for_concepts():
#     response = client.post("/api/v1/vocabularies", json={"id": "v2", "name": "Concept Vocabulary"})
#     assert response.status_code == 201

# def test_create_concept():
#     response = client.post("/api/v1/vocabularies/v2/concepts", json={"id": "c1", "name": "Concept One"})
#     assert response.status_code == 201
#     assert response.json()["id"] == "c1"

# def test_get_concepts():
#     response = client.get("/api/v1/vocabularies/v2/concepts")
#     assert response.status_code == 200
#     assert isinstance(response.json(), list)

# def test_get_specific_concept():
#     response = client.get("/api/v1/vocabularies/v2/concepts/c1")
#     assert response.status_code == 200
#     assert response.json()["name"] == "Concept One"

# def test_delete_concept():
#     response = client.delete("/api/v1/vocabularies/v2/concepts/c1")
#     assert response.status_code == 204

# def test_delete_nonexistent_concept():
#     response = client.delete("/api/v1/vocabularies/v2/concepts/nonexistent")
#     assert response.status_code == 404
