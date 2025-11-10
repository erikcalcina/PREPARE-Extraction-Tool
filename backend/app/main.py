from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.routes.v1 import api_router
from app.core.settings import settings


app = FastAPI(
    title=settings.SERVICE_NAME,
    openapi_url="/api/openapi.json"
)


if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


app.include_router(api_router, prefix=settings.API_V1_STR)
