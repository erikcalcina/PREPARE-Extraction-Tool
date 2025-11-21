from fastapi import APIRouter, status

from app.models import MessageOutput

# ================================================
# Route definitions
# ================================================

router = APIRouter()


@router.post("/check", response_model=MessageOutput, status_code=status.HTTP_200_OK)
def health_check():
    return MessageOutput(message="Health check successful")

