from typing import Union, List

from app.core.models.embedding_base import BaseModel
from sentence_transformers import SentenceTransformer


class SentenceEmbeddingModel(BaseModel):

    def __init__(self, model_name_or_path: str):
        super().__init__(model_name_or_path)
        self.model = SentenceTransformer(model_name_or_path)

    def embed(self, text: Union[str, List[str]]) -> List[float]:
        return self.model.encode(text).tolist()