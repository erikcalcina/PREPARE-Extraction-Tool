from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.routes.v1 import api_router
from app.core.settings import settings
from app.core.database import init_db

from app.core.elastic import check_es_connection
from app.core.model_registry import register_models

# ================================================
# Application setup
# ================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register the models
    register_models()
    # Initialize the database
    init_db()
    # Check the connection to Elasticsearch
    check_es_connection()
    yield


# initialize the FastAPI app
app = FastAPI(
    title=settings.SERVICE_NAME,
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# add API routes
app.include_router(api_router, prefix=settings.API_V1_STR)
