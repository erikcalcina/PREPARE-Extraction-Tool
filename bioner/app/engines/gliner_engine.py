import re
from typing import List
from gliner import GLiNER

from app.interfaces import Entity
from .base_engine import BaseEngine

class GlinerEngine(BaseEngine):
    def __init__(self, 
                 model="urchade/gliner_medium-v2.1", 
                 device="cuda", 
                 labels: list[str] | None = None, 
                 threshold=0.5):
        super().__init__(model=model, device=device)
        self.labels = labels
        self.threshold = threshold
        self._initialize()

    def _initialize(self):
        self.model = GLiNER.from_pretrained(self.model, 
                                            load_tokenizer=False, 
                                            local_files_only=False)
        self.model.to(self.device)

    def extract_entities(self, medical_text: str, labels: list[str]) -> List[Entity]:
        medical_text_chunks = trim_medical_text(medical_text, max_words=384)
        print(f"Number of chunks: {len(medical_text_chunks)}")
        all_entities: List[Entity] = []
        global_offset = 0

        for chunk in medical_text_chunks:
            if not chunk.strip():
                continue
            # 1) Run GLiNER on the chunk
            predictions = self.model.predict_entities(
                chunk,
                labels=labels,
                threshold=self.threshold,
            )
            # 2) Convert local offsets → global offsets
            for p in predictions:
                local_start = int(p["start"])
                local_end = int(p["end"])

                all_entities.append(
                    Entity(
                        text=p["text"],
                        label=p["label"],
                        start=global_offset + local_start,
                        end=global_offset + local_end,
                        score=float(p.get("score")) if p.get("score") is not None else None,
                    )
                )
            # 3) Move to the next chunk's starting global offset
            global_offset += len(chunk)

        return all_entities

whitespace_pattern = re.compile(r'\w+(?:[-_]\w+)*|\S')

def trim_medical_text(medical_text: str, max_words: int = 384) -> List[str]:
    """
    Split text into sentence-based chunks that do not exceed max_tokens,
    counting tokens with GLiNER's whitespace regex.
    """
    # Split into sentences retaining the period
    sentences = re.findall(r'[^.]*\.', medical_text)
    if not sentences:
        # fallback: no '.' at all, treat whole text as one "sentence"
        sentences = [medical_text]

    chunks: List[str] = []
    current_chunk = ""

    def token_len(text: str) -> int:
        # Count tokens using GLiNER-like whitespace splitting
        return len(whitespace_pattern.findall(text))

    # TODO: handle cases where a single sentence exceeds max_tokens
    for sentence in sentences:
        # If adding this sentence exceeds the token limit → new chunk
        if current_chunk and token_len(current_chunk + sentence) > max_words:
            chunks.append(current_chunk)
            current_chunk = sentence
            print("Chunk length:", len(current_chunk))
        else:
            current_chunk += sentence

    if current_chunk:
        chunks.append(current_chunk)

    return chunks

