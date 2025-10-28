from typing import List

from app.interfaces import Entity

class BaseEngine:
    def __init__(self, 
                 model_path: str, 
                 *args, 
                 device: str = "cpu", 
                 **kwargs):
        self.model_path = model_path
        self.device = device

    def extract_entities(self, 
                         medical_text: str, 
                         *args, 
                         labels: list[str] | None = None, 
                         **kwargs) -> List[Entity]:
        raise NotImplementedError("Subclasses must implement this method")
