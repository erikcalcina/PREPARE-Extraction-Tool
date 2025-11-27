from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from elasticsearch.exceptions import ApiError

from app.routes.v1 import api_router
from app.core.settings import settings
from app.core.database import init_db
from app.core.elastic import check_es_connection
from app.core.model_registry import register_models
from app.core.middleware import SecurityHeadersMiddleware
from app.core.exceptions import (
    database_exception_handler,
    elasticsearch_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
)

# ================================================
# Application setup
# ================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the database
    init_db()
    # Register the models
    register_models()
    # Check connection to elasticsearch
    check_es_connection()
    yield


# initialize the FastAPI app
app = FastAPI(
    title=settings.SERVICE_NAME, openapi_url="/api/openapi.json", lifespan=lifespan
)

# ================================================
# Middleware configuration
# ================================================

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# ================================================
# Exception handlers
# ================================================

# Register exception handlers
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(ApiError, elasticsearch_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(ValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# ================================================
# API routes
# ================================================

# add API routes
app.include_router(api_router, prefix=settings.API_V1_STR)
