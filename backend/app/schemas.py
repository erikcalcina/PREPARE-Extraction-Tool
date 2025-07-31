from pydantic import BaseModel

class UserCreate(BaseModel):
    user_name: str
    user_pass: str

class UserLogin(BaseModel):
    user_name: str
    user_pass: str

class UserOut(BaseModel):
    user_id: int
    user_name: str

class Config:
    from_attributes = True
