from pydantic import BaseModel
from typing import Optional, TypedDict

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

class MessageOutput(TypedDict):
    message: str