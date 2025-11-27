from fastapi import APIRouter, status

from app.schemas import MessageOutput

# ================================================
# Route definitions
# ================================================

router = APIRouter()


@router.post(
    "/check",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Verifies that the API is running and responding to requests",
    response_description="Confirmation message that the health check was successful",
)
def health_check():
    return MessageOutput(message="Health check successful")
