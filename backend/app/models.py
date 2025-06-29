import uuid

from typing_extensions import TypedDict
from sqlmodel import Field, Relationship, SQLModel

# ================================================
# Definitions (FastAPI)
# ================================================


class MessageOutput(TypedDict):
    message: str
