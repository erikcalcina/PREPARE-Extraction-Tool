from app.core.models.embedding_base import BaseModel
from app.core.models.embedding_sentence import SentenceEmbeddingModel

from app.core.settings import settings

# ================================================
# Model registry
# ================================================

class ModelRegistry:
    def __init__(self):
        self.models = {}

    def add_model(self, model_name: str, model: BaseModel):
        self.models[model_name] = model

    def get_model(self, model_name: str):
        return self.models[model_name]

# Initialize the model registry
model_registry = ModelRegistry()

# ================================================
# Register models function
# ================================================

def register_models():
    # Register the embedding model
    if settings.EMBEDDING_MODEL is not None:
        model_registry.add_model("embedding", SentenceEmbeddingModel(settings.EMBEDDING_MODEL))

    # TODO: Register the other models
