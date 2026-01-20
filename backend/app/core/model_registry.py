from app.core.models.embedding_base import BaseModel
from app.core.models.embedding_model2vec import Model2VecEmbeddingModel
from app.core.models.embedding_sentence import SentenceEmbeddingModel

from app.core.settings import settings

# ================================================
# Model registry
# ================================================


class ModelRegistry:
    """Registry for managing machine learning models.

    This class provides a central registry for storing and retrieving
    machine learning models by name. It acts as a singleton container
    for all models used in the application.

    Attributes:
        models (dict): Dictionary mapping model names to model instances.
    """

    def __init__(self):
        """Initialize the ModelRegistry with an empty models dictionary."""
        self.models = {}

    def add_model(self, model_name: str, model: BaseModel):
        """Add a model to the registry.

        Args:
            model_name (str): The name to register the model under.
            model (BaseModel): The model instance to register.

        Returns:
            None
        """
        self.models[model_name] = model

    def get_model(self, model_name: str):
        """Retrieve a model from the registry by name.

        Args:
            model_name (str): The name of the model to retrieve.

        Returns:
            BaseModel: The registered model instance.

        Raises:
            KeyError: If the model name is not found in the registry.
        """
        return self.models[model_name]


# Initialize the model registry
model_registry = ModelRegistry()

# ================================================
# Register models function
# ================================================


def register_models():
    """Register all configured models with the model registry."""
    # Register the embedding model
    if settings.EMBEDDING_MODEL_SENTENCE is not None:
        model_registry.add_model(
            "embedding_sentence",
            SentenceEmbeddingModel(settings.EMBEDDING_MODEL_SENTENCE),
        )
    if settings.EMBEDDING_MODEL_MODEL2VEC is not None:
        model_registry.add_model(
            "embedding_model2vec",
            Model2VecEmbeddingModel(settings.EMBEDDING_MODEL_MODEL2VEC),
        )

    # TODO: Register the other models
