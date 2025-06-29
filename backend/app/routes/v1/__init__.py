from fastapi import APIRouter

from app.routes.v1 import index

api_router = APIRouter()
api_router.include_router(index.router, prefix="", tags=["Index"])
