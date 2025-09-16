from fastapi import APIRouter
from typing import List
import io
import csv
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.core.database import get_db
from fastapi import APIRouter, HTTPException, Depends
from app.models_db import Vocabulary, Concept
from app.models import VocabularyCreate, ConceptCreate, MessageOutput
from sqlmodel import select, Session

router = APIRouter(tags=["Vocabularies"])

# VOCABULARIES

@router.post("/", response_model=MessageOutput, status_code=201)
def create_vocabulary(vocab: VocabularyCreate, db: Session = Depends(get_db)):
    vocab_db = Vocabulary(
        vocab_name=vocab.vocab_name,
        vocab_version=vocab.vocab_version
    )
    db.add(vocab_db)
    db.commit()
    db.refresh(vocab_db)

    for c in vocab.concepts:
        concept_db = Concept(
            vocab_id=vocab_db.vocab_id,
            vocab_term_id=c.vocab_term_id,
            vocab_term_name=c.vocab_term_name
        )
        db.add(concept_db)
    db.commit()

    return {"message": "Vocabulary created"}

@router.get("/", response_model=List[Vocabulary])
def get_vocabularies(db: Session = Depends(get_db)):
    vocabularies = db.exec(select(Vocabulary)).all()
    return vocabularies

@router.get("/{vocabulary_id}", response_model=Vocabulary)
def get_vocabulary(vocabulary_id: int, db: Session = Depends(get_db)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=404, detail="Vocabulary not found")

    return vocab_db

@router.delete("/{vocabulary_id}", response_model=MessageOutput)
def delete_vocabulary(vocabulary_id: int, db: Session = Depends(get_db)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=404, detail="Vocabulary not found")
    
    db.delete(vocab_db)
    db.commit()

    return {"message": "Vocabulary deleted"}

@router.get("/{vocabulary_id}/download", response_class=StreamingResponse)
def download_vocabulary_csv(vocabulary_id: int, db: Session = Depends(get_db)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=404, detail="Vocabulary not found")

    concepts = vocab_db.concepts

    if not concepts:
        raise HTTPException(status_code=404, detail="No concepts found for this vocabulary")

    # Prepare CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["vocab_term_id", "vocab_term_name"])
    writer.writeheader()
    for c in concepts:
        writer.writerow({
            "vocab_term_id": c.vocab_term_id,
            "vocab_term_name": c.vocab_term_name
        })

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={vocab_db.vocab_name}.csv"}
    )


# CONCEPTS

@router.post("/{vocabulary_id}/concepts", response_model=MessageOutput, status_code=201)
def add_concept(vocabulary_id: int, concept: ConceptCreate, db: Session = Depends(get_db)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=404, detail="Vocabulary not found")
    
    concept_db = Concept(
        vocab_id=vocabulary_id,
        vocab_term_id=concept.vocab_term_id,
        vocab_term_name=concept.vocab_term_name
    )
    db.add(concept_db)
    db.commit()

    return {"message": "Concept added"}

@router.get("/{vocabulary_id}/concepts", response_model=List[Concept])
def get_concepts(vocabulary_id: int, db: Session = Depends(get_db)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=404, detail="Vocabulary not found")
    
    return vocab_db.concepts

@router.get("/{vocabulary_id}/concepts/{concept_id}", response_model=Concept)
def get_concept(vocabulary_id: int, concept_id: int, db: Session = Depends(get_db)):
    statement = (
        select(Concept)
        .where(Concept.vocab_id == vocabulary_id)
        .where(Concept.concept_id == concept_id)
    )
    concept_db = db.exec(statement).one_or_none()

    if concept_db is None:
        raise HTTPException(status_code=404, detail="Concept not found")
    
    return concept_db

@router.delete("/{vocabulary_id}/concepts/{concept_id}", response_model=MessageOutput)
def delete_concept(vocabulary_id: int, concept_id: int, db: Session = Depends(get_db)):
    statement = (
        select(Concept)
        .where(Concept.vocab_id == vocabulary_id)
        .where(Concept.concept_id == concept_id))
    concept_db = db.exec(statement).one_or_none()

    if concept_db is None:
        raise HTTPException(status_code=404, detail="Concept not found")
    
    db.delete(concept_db)
    db.commit()

    return {"message": "Concept deleted"}