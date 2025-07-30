from app.core.database import engine
from app.models_db import Base

Base.metadata.create_all(bind=engine)