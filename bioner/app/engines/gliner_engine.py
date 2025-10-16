from typing import List

import torch
from gliner import GLiNER

from app.interfaces import Entity
from .base_engine import BaseEngine

class GlinerEngine(BaseEngine):
    def __init__(self, model_name="urchade/gliner_medium-v2.1", device="cuda", labels: list[str] | None = None, threshold=0.5):
        super().__init__(model_name=model_name, device=device)
        self.labels = labels
        self.threshold = threshold
        self._initialize()

    def _initialize(self):
        self.model = GLiNER.from_pretrained(self.model_name, load_tokenizer=False, local_files_only=False)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(device)

    def extract_entities(self, medical_text: str, labels: list[str]) -> List[Entity]:
        predictions = self.model.predict_entities(medical_text, labels=labels, threshold=self.threshold)
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

