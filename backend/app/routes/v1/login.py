from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.schemas import UserCreate, UserLogin
from app.crud import user as crud_user
from app.core.database import get_db  
from app.models_db import UsersDB

router = APIRouter()

@router.post("/login")
def login_user(data: UserLogin, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_username(db, data.user_name)
    if user and user.user_pass == data.user_pass:
        return {"message": "Login successful!"}
    raise ValueError(status_code=401, detail="Invalid username or password")

@router.post("/register")
def register_user(data: UserCreate, db: Session = Depends(get_db)):
    existing_user = crud_user.get_user_by_username(db, data.user_name)
    if existing_user:
        raise ValueError(status_code=400, detail="User already exists")
    crud_user.create_user(db, data.user_name, data.user_pass)
    return {"message": f"User {data.user_name} registered successfully"}
