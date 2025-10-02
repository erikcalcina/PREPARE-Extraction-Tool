from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlmodel import Session, select

from app.core.database import get_db
from app.models import MessageOutput, UserModel
from app.models_db import User


router = APIRouter(tags=["Login"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

@router.post("/login", response_model=MessageOutput, status_code=status.HTTP_202_ACCEPTED)
def login_user(data: UserModel, db: Session = Depends(get_db)):
    statement = (select(User).where(User.name == data.name))
    user = db.exec(statement).one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username")

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    
    return MessageOutput(message=f"Login successful: {user.name}")

@router.post("/register", response_model=MessageOutput, status_code=status.HTTP_201_CREATED)
def register_user(data: UserModel, db: Session = Depends(get_db)):
    statement = select(User).where(User.name == data.name)
    existing_user = db.exec(statement).one_or_none()

    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
    
    hashed_password = hash_password(data.password)
    user = User(name=data.name, hashed_password=hashed_password)
    db.add(user)
    db.commit()

    return MessageOutput(message=f"User {data.name} registered successfully")
    
