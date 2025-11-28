from typing import Union, List

from app.core.models.embedding_base import BaseModel
from sentence_transformers import SentenceTransformer


class SentenceEmbeddingModel(BaseModel):
    """Embedding model implementation using SentenceTransformers.

    Attributes:
        model_name_or_path (str): The name or path of the model (inherited).
        model (SentenceTransformer): The loaded SentenceTransformer model instance.
    """

    def __init__(self, model_name_or_path: str):
        """Initialize the SentenceEmbeddingModel with a specific model.

        Args:
            model_name_or_path (str): The name or file path of the SentenceTransformer
                model to load. Can be a HuggingFace model name or a local path.
        """
        super().__init__(model_name_or_path)
        self.model = SentenceTransformer(model_name_or_path)

    def embed(
        self, text: Union[str, List[str]]
    ) -> Union[List[float], List[List[float]]]:
        """Convert text into vector embeddings using SentenceTransformers.

        Args:
            text (Union[str, List[str]]): A single text string or list of text
                strings to convert into embeddings.

        Returns:
            List[float]: The embedding vector(s) as a list of floats. For a single
                string input, returns a single vector. For a list of strings, returns
                a list of vectors.
        """
        return self.model.encode(text).tolist()
