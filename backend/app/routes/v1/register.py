from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict

router = APIRouter()

# Input model for registration
class RegisterRequest(BaseModel):
    name: str
    password: str

# Temporary in-memory user store
user_db: Dict[str, Dict[str, str]] = {}

@router.post("/api/v1/register", tags=["Auth"])
async def register_user(user: RegisterRequest):
    if user.name in user_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    user_db[user.name] = {
        "password": user.password
    }

    return {"message": "Registration successful"}
