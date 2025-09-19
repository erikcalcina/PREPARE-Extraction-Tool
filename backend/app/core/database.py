from sqlmodel import SQLModel, create_engine, Session
from app.core.settings import settings
from app.models_db import User, Dataset, Record, SourceTerm, Concept, Vocabulary, SourceToConceptMap

engine = create_engine(settings.database_url, echo=True) 

# Create all tables if not already created
SQLModel.metadata.create_all(engine)


def get_db():
    with Session(engine) as session:
        yield session
