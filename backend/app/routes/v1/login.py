from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models import MessageOutput, UserModel
from app.core.database import get_db  
from app.models_db import User
from sqlmodel import select, Session

router = APIRouter(tags=["Login"])

@router.post("/login", response_model=MessageOutput, status_code=202)
def login_user(data: UserModel, db: Session = Depends(get_db)):
    statement = (
        select(User)
        .where(User.user_name == data.user_name)
        .where(User.user_pass == data.user_pass)
    )
    user = db.exec(statement).one_or_none()

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {"message": f"Login successful: {user.user_name}"}

@router.post("/register", response_model=MessageOutput, status_code=201)
def register_user(data: UserModel, db: Session = Depends(get_db)):
    statement = select(User).where(User.user_name == data.user_name)
    existing_user = db.exec(statement).one_or_none()

    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    user = User(user_name=data.user_name, user_pass=data.user_pass)
    db.add(user)
    db.commit()

    return {"message": f"User {data.user_name} registered successfully"}
    
