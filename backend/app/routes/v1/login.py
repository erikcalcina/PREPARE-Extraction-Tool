from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlmodel import Session, select

from app.core.database import get_session, User
from app.models import MessageOutput, UserModel

# ================================================
# Helper functions
# ================================================

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# ================================================
# Route definitions
# ================================================

router = APIRouter()

@router.post("/login", response_model=MessageOutput, status_code=status.HTTP_202_ACCEPTED)
def login_user(data: UserModel, db: Session = Depends(get_session)):
    statement = (select(User).where(User.username == data.username))
    user = db.exec(statement).one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    return MessageOutput(message=f"Login successful")

@router.post("/register", response_model=MessageOutput, status_code=status.HTTP_201_CREATED)
def register_user(data: UserModel, db: Session = Depends(get_session)):
    statement = select(User).where(User.username == data.username)
    existing_user = db.exec(statement).one_or_none()

    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to register user")

    hashed_password = hash_password(data.password)
    user = User(username=data.username, hashed_password=hashed_password)
    db.add(user)
    db.commit()

    return MessageOutput(message=f"Registration successful")

