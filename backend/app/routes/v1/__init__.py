from fastapi import APIRouter

from app.routes.v1 import index
from app.routes.v1 import login 
from app.routes.v1 import register 

api_router = APIRouter()
api_router.include_router(index.router, prefix="", tags=["Index"])
api_router.include_router(login.router, prefix="", tags=["Auth"])  
api_router.include_router(register.router, prefix="", tags=["Auth"])