from fastapi import APIRouter
from app.routes.v1 import login, vocabularies, datasets, source_term, health

api_router = APIRouter()

# Health check route
api_router.include_router(health.router, prefix="/health", tags=["Health"])

# Main routes
api_router.include_router(login.router, prefix="/login", tags=["Login"])
api_router.include_router(vocabularies.router, prefix="/vocabularies", tags=["Vocabularies"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets"])
api_router.include_router(source_term.router, prefix="/source-term", tags=["Source Term"])