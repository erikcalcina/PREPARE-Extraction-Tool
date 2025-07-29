from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.utils.fake_db import fake_users_db
from app.models import LoginRequest, RegisterRequest
router = APIRouter()



@router.post("/login")
def login_user(data: LoginRequest):
    user = fake_users_db.get(data.username)
    if user and user["password"] == data.password:
        return {"message": "Login successful!"}
    raise HTTPException(status_code=401, detail="Invalid username or password")

@router.post("/register")
def register_user(data: RegisterRequest):
    if data.username in fake_users_db:
        raise HTTPException(status_code=400, detail="User already exists")
    fake_users_db[data.username] = {
        "username": data.username,
        "password": data.password
    }
    return {"message": f"User {data.username} registered successfully"}
