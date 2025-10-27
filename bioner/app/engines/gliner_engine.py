from typing import List
from gliner import GLiNER

from app.interfaces import Entity
from .base_engine import BaseEngine

class GlinerEngine(BaseEngine):
    def __init__(self, 
                 model_path="urchade/gliner_medium-v2.1", 
                 device="cuda", 
                 labels: list[str] | None = None, 
                 threshold=0.5):
        super().__init__(model_path=model_path, device=device)
        self.labels = labels
        self.threshold = threshold
        self._initialize()

    def _initialize(self):
        self.model = GLiNER.from_pretrained(self.model_path, 
                                            load_tokenizer=False, 
                                            local_files_only=False)
        self.model.to(self.device)

    def extract_entities(self, medical_text: str, labels: list[str]) -> List[Entity]:
        predictions = self.model.predict_entities(medical_text, 
                                                  labels=labels, 
                                                  threshold=self.threshold)
        return [
            Entity(
                text=p["text"],
                label=p["label"],
                start=int(p["start"]),
                end=int(p["end"]),
                score=float(p["score"]) if p.get("score") is not None else None,
            )
            for p in predictions
        ]

