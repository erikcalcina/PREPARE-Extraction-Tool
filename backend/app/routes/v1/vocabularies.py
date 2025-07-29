from fastapi import APIRouter, UploadFile, File, HTTPException
from app.utils.fake_db import fake_vocabularies_db, uploaded_filenames
from app.models import VocabularyInput, ConceptInput

router = APIRouter(
    prefix="/api/v1/vocabularies",
    tags=["Vocabularies"]
)


class VocabularyService:
    def __init__(self, db):
        self.db = db

    async def create_vocabulary(self, vocab: VocabularyInput):
        # TODO: Insert vocabulary into database
        for v in self.db:
            if v["id"] == vocab.id:
                raise HTTPException(status_code=400, detail="Vocabulary already exists")
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
        raise HTTPException(status_code=404, detail="Vocabulary not found")

    async def delete_vocabulary(self, vocabulary_id: str):
        # TODO: Delete vocabulary by ID from database
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                self.db.remove(vocab)
                return
        raise HTTPException(status_code=404, detail="Vocabulary not found")

    async def add_concept(self, vocabulary_id: str, concept: ConceptInput):
        # TODO: Insert concept into vocabulary in database
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                for c in vocab["concepts"]:
                    if c["id"] == concept.id:
                        raise HTTPException(status_code=400, detail="Concept already exists")
                vocab["concepts"].append({
                    "id": concept.id,
                    "name": concept.name
                })
                return {"id": concept.id, "name": concept.name}
        raise HTTPException(status_code=404, detail="Vocabulary not found")

    async def get_concepts(self, vocabulary_id: str):
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                return vocab["concepts"]
        raise HTTPException(status_code=404, detail="Vocabulary not found")

    async def get_specific_concept(self, vocabulary_id: str, concept_id: str):
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                for concept in vocab["concepts"]:
                    if concept["id"] == concept_id:
                        return concept
                raise HTTPException(status_code=404, detail="Concept not found")
        raise HTTPException(status_code=404, detail="Vocabulary not found")

    async def delete_concept(self, vocabulary_id: str, concept_id: str):
        # TODO: Delete concept from vocabulary in database
        for vocab in self.db:
            if vocab["id"] == vocabulary_id:
                for concept in vocab["concepts"]:
                    if concept["id"] == concept_id:
                        vocab["concepts"].remove(concept)
                        return
                raise HTTPException(status_code=404, detail="Concept not found")
        raise HTTPException(status_code=404, detail="Vocabulary not found")


service = VocabularyService(fake_vocabularies_db)

router.post("/", status_code=201)(service.create_vocabulary)
router.get("/")(service.get_vocabularies)
router.get("/{vocabulary_id}")(service.get_specific_vocabulary)
router.delete("/{vocabulary_id}", status_code=204)(service.delete_vocabulary)
router.post("/{vocabulary_id}/concepts", status_code=201)(service.add_concept)
router.get("/{vocabulary_id}/concepts")(service.get_concepts)
router.get("/{vocabulary_id}/concepts/{concept_id}")(service.get_specific_concept)
router.delete("/{vocabulary_id}/concepts/{concept_id}", status_code=204)(service.delete_concept)
