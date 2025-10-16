from typing import List
from app.interfaces import Entity

class BaseEngine:
    def __init__(self, model_name: str, *args, device: str = "cpu", **kwargs):
        self.model_name = model_name
        self.device = device

    def extract_entities(self, text: str, *args, labels: list[str] | None = None, **kwargs) -> List[Entity]:
        raise NotImplementedError("Subclasses must implement this method")
