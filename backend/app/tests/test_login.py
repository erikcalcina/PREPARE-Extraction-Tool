# from fastapi.testclient import TestClient
# from app.main import app
# from app.utils.fake_db import fake_users_db, reset_fake_db

# client = TestClient(app)

# def setup_function():
#     fake_users_db.clear()
#     fake_users_db["admin"] = {"username": "admin", "password": "1234"}

# def test_register_user_success():
#     response = client.post("/register", json={"username": "newuser", "password": "newpass"})
#     assert response.status_code == 200
#     assert response.json() == {"message": "User newuser registered successfully"}

# def test_register_user_existing():
#     response = client.post("/register", json={"username": "admin", "password": "1234"})
#     assert response.status_code == 400
#     assert response.json()["detail"] == "User already exists"

# def test_login_user_success():
#     response = client.post("/login", json={"username": "admin", "password": "1234"})
#     assert response.status_code == 200
#     assert response.json() == {"message": "Login successful!"}

# def test_login_user_wrong_password():
#     response = client.post("/login", json={"username": "admin", "password": "wrongpass"})
#     assert response.status_code == 401
#     assert response.json()["detail"] == "Invalid username or password"
