from fastapi import APIRouter
from app.routes.v1 import auth, vocabularies, datasets, source_term, health, bioner

api_router = APIRouter()

# Health check route
api_router.include_router(health.router, prefix="/health", tags=["Health"])

# Authentication routes
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])

# Main routes
api_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets"])
api_router.include_router(
    vocabularies.router, prefix="/vocabularies", tags=["Vocabularies"]
)
api_router.include_router(
    source_term.router, prefix="/source-terms", tags=["Source Terms"]
)
api_router.include_router(bioner.router, prefix="/bioner", tags=["BioNER"])
