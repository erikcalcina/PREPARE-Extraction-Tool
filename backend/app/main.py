from fastapi import FastAPI
from app.routes.v1 import login
from app.routes.v1 import vocabularies
app = FastAPI()

app.include_router(login.router)
app.include_router(vocabularies.router)