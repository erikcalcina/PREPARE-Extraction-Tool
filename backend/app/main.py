from fastapi import FastAPI
from app.routes.v1 import login

app = FastAPI()

app.include_router(login.router)