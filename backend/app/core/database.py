from sqlmodel import Session, SQLModel, create_engine

from app.core.settings import settings
from app.models_db import *

# ================================================
# Database engine initialization
# ================================================

# TODO: Add echo=False in production
engine = create_engine(settings.DATABASE_URL, echo=True)

# ================================================
# Database functions
# ================================================

def init_db():
    """Create all tables if not already created"""
    SQLModel.metadata.create_all(engine)

def get_session():
    """Get a session from the engine"""
    with Session(engine) as session:
        yield session
