from fastapi import FastAPI
from app.routes.v1 import login
from app.routes.v1 import vocabularies
from app.routes.v1 import datasets
from app.routes.v1 import source_term
app = FastAPI()

app.include_router(login.router)
app.include_router(vocabularies.router)
app.include_router(datasets.router)
app.include_router(source_term.router)
