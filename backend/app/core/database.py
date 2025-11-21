from sqlmodel import Session, SQLModel, create_engine

from app.core.settings import settings
from app.models_db import *

engine = create_engine(settings.database_url, echo=True) 

# Create all tables if not already created
SQLModel.metadata.create_all(engine)

def get_db():
    with Session(engine) as session:
        yield session
