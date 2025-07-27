from app.utils.fake_db import fake_vocabularies_db, uploaded_filenames
from app.models import VocabularyInput,ConceptInput
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import uuid

router = APIRouter(
    prefix="/api/v1/vocabularies",
    tags=["Vocabularies"]
)

@router.post("/", status_code=201)
async def create_vocabulary(vocab: VocabularyInput):
    # TODO: Insert vocabulary into database
    for v in fake_vocabularies_db:
        if v["id"] == vocab.id:
            raise HTTPException(status_code=400, detail="Vocabulary already exists")
    fake_vocabularies_db.append({
        "id": vocab.id,
        "name": vocab.name,
        "concepts": []
    })
    return {"id": vocab.id, "name": vocab.name}

@router.get("/")
async def get_vocabularies():
    return fake_vocabularies_db
@router.get("/{vocabulary_id}")
async def get_specific_vocabulary(vocabulary_id: str):
    for vocab in fake_vocabularies_db:
        if vocab["id"] == vocabulary_id:
            return vocab
    raise HTTPException(status_code=404, detail="Vocabulary not found")

@router.delete("/{vocabulary_id}", status_code=204)
async def delete_vocabulary(vocabulary_id: str):
    # TODO: Delete vocabulary by ID from database
    global fake_vocabularies_db
    for vocab in fake_vocabularies_db:
        if vocab["id"] == vocabulary_id:
            fake_vocabularies_db.remove(vocab)
            return
    raise HTTPException(status_code=404, detail="Vocabulary not found")

@router.post("/{vocabulary_id}/concepts", status_code=201)
async def add_concept(vocabulary_id: str, concept: ConceptInput):
    # TODO: Insert concept into vocabulary in database
    for vocab in fake_vocabularies_db:
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

@router.get("/{vocabulary_id}/concepts")
async def get_concepts(vocabulary_id: str):
    for vocab in fake_vocabularies_db:
        if vocab["id"] == vocabulary_id:
            return vocab["concepts"]
    raise HTTPException(status_code=404, detail="Vocabulary not found")

@router.get("/{vocabulary_id}/concepts/{concept_id}")
async def get_specific_concept(vocabulary_id: str, concept_id: str):
    for vocab in fake_vocabularies_db:
        if vocab["id"] == vocabulary_id:
            for concept in vocab["concepts"]:
                if concept["id"] == concept_id:
                    return concept
            raise HTTPException(status_code=404, detail="Concept not found")
    raise HTTPException(status_code=404, detail="Vocabulary not found")

@router.delete("/{vocabulary_id}/concepts/{concept_id}", status_code=204)
async def delete_concept(vocabulary_id: str, concept_id: str):
    # TODO: Delete concept from vocabulary in database
    for vocab in fake_vocabularies_db:
        if vocab["id"] == vocabulary_id:
            for concept in vocab["concepts"]:
                if concept["id"] == concept_id:
                    vocab["concepts"].remove(concept)
                    return
            raise HTTPException(status_code=404, detail="Concept not found")
    raise HTTPException(status_code=404, detail="Vocabulary not found")
