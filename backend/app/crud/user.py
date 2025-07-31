from sqlalchemy.orm import Session
from app.models_db import UsersDB

def get_user_by_username(db: Session, username: str):
    return db.query(UsersDB).filter(UsersDB.user_name == username).first()

def create_user(db: Session, username: str, password: str):
    user = UsersDB(user_name=username, user_pass=password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user