from fastapi import HTTPException
from app.models import VocabularyInput, ConceptInput

class VocabularyService:
    def __init__(self, db):
        self.db = db

    async def create_vocabulary(self, vocab: VocabularyInput):
        for v in self.db:
            if v["id"] == vocab.id:
                raise ValueError(status_code=400, detail="Vocabulary already exists")
        self.db.append({
            "id": vocab.id,
            "name": vocab.name,
            "concepts": []
        })
        return {"id": vocab.id, "name": vocab.name}

    async def get_vocabularies(self):
        return self.db

    async def get_specific_vocabulary(self, vocabulary_id: str):
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                return vocab
        raise ValueError(status_code=404, detail="Vocabulary not found")

    async def delete_vocabulary(self, vocabulary_id: str):
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                self.db.remove(vocab)
                return
        raise ValueError(status_code=404, detail="Vocabulary not found")

    async def add_concept(self, vocabulary_id: str, concept: ConceptInput):
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                for c in vocab["concepts"]:
                    if c["id"] == concept.id:
                        raise ValueError(status_code=400, detail="Concept already exists")
                vocab["concepts"].append({
                    "id": concept.id,
                    "name": concept.name
                })
                return {"id": concept.id, "name": concept.name}
        raise ValueError(status_code=404, detail="Vocabulary not found")

    async def get_concepts(self, vocabulary_id: str):
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                return vocab["concepts"]
        raise ValueError(status_code=404, detail="Vocabulary not found")

    async def get_specific_concept(self, vocabulary_id: str, concept_id: str):
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                for concept in vocab["concepts"]:
                    if concept["id"] == concept_id:
                        return concept
                raise ValueError(status_code=404, detail="Concept not found")
        raise ValueError(status_code=404, detail="Vocabulary not found")

    async def delete_concept(self, vocabulary_id: str, concept_id: str):
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                for concept in vocab["concepts"]:
                    if concept["id"] == concept_id:
                        vocab["concepts"].remove(concept)
                        return
                raise ValueError(status_code=404, detail="Concept not found")
        raise ValueError(status_code=404, detail="Vocabulary not found")
