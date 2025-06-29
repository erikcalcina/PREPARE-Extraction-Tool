from typing import Any

from fastapi import APIRouter, status

from app.models import MessageOutput


router = APIRouter()

# ================================================
# Helper methods
# ================================================

# TODO

# ================================================
# Route definitions
# ================================================


@router.get(
    "/",
    status_code=status.HTTP_200_OK,
    description="Index",
    response_model=MessageOutput,
)
async def index() -> Any:
    return {"message": "Hello World"}
