from typing import Union, List

from app.core.models.embedding_base import BaseModel

from model2vec import StaticModel


class Model2VecEmbeddingModel(BaseModel):

    def __init__(self, model_name_or_path: str):
        super().__init__(model_name_or_path)
        # Loads a pretrained Model2Vec model from HF or local path
        self.model = StaticModel.from_pretrained(model_name_or_path)

    def embed(self, text: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        # model2vec returns numpy arrays, probably needed to convert to python?
        emb = self.model.encode(text)
        return emb.tolist()
