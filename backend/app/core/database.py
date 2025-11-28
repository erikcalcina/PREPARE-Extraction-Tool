from sqlmodel import Session, SQLModel, create_engine

from app.core.settings import settings
from app.models_db import *  # noqa: F403

# ================================================
# Database engine initialization
# ================================================

# TODO: Add echo=False in production
engine = create_engine(settings.DATABASE_URL, echo=settings.ENVIRONMENT == "local")

# ================================================
# Database functions
# ================================================


def init_db():
    """Initialize the database by creating all tables."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Get a database session from the engine.

    This is a generator function that yields a SQLModel Session object.
    It is designed to be used as a dependency in FastAPI endpoints.
    The session is automatically closed when the context exits.

    Yields:
        Session: A SQLModel database session.

    Example:
        >>> from fastapi import Depends
        >>> def my_endpoint(session: Session = Depends(get_session)):
        ...     # Use session here
        ...     pass
    """
    with Session(engine) as session:
        yield session
