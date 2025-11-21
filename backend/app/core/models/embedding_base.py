from typing import Union, List

class BaseModel:

    def __init__(self, model_name_or_path: str):
        self.model_name_or_path = model_name_or_path

    def embed(self, text: Union[str, List[str]]) -> List[float]:
        raise NotImplementedError("Subclasses must implement this method")