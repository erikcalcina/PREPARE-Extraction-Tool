import io
import csv
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.core.database import get_session, Vocabulary, Concept
from app.models import ConceptCreate, MessageOutput, VocabularyCreate
from app.library.concept_indexer import indexer

# ================================================
# Route definitions
# ================================================

router = APIRouter()

# ================================================
# Vocabularies routes
# ================================================


@router.post("/", response_model=MessageOutput, status_code=status.HTTP_201_CREATED)
def create_vocabulary(vocab: VocabularyCreate, db: Session = Depends(get_session)):
    vocab_db = Vocabulary(
        name=vocab.name,
        version=vocab.version
    )
    db.add(vocab_db)
    db.commit()
    db.refresh(vocab_db)
    vocab_id = vocab_db.id

    # NEED TO CREATE NEW ES ALSO
    indexer.create_concept_index(vocab_id)

    for c in vocab.concepts:
        concept_db = Concept(
            vocabulary_id=vocab_id,
            vocab_term_id=c.vocab_term_id,
            vocab_term_name=c.vocab_term_name
        )
        db.add(concept_db)
    db.commit()

    for c in vocab_db.concepts:
        db.refresh(c)

    db.refresh(vocab_db)

    # NEED TO ADD CONCEPTS TO INDEX
    indexer.add_bulk_to_index(vocab_id, vocab_db.concepts)

    return MessageOutput(message="Vocabulary created")

@router.get("/", response_model=List[Vocabulary])
def get_vocabularies(db: Session = Depends(get_session)):
    vocabularies = db.exec(select(Vocabulary)).all()
    return vocabularies

@router.get("/{vocabulary_id}", response_model=Vocabulary)
def get_vocabulary(vocabulary_id: int, db: Session = Depends(get_session)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found")

    return vocab_db

@router.delete("/{vocabulary_id}", response_model=MessageOutput)
def delete_vocabulary(vocabulary_id: int, db: Session = Depends(get_session)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found")

    db.delete(vocab_db)
    db.commit()

    indexer.delete_index(vocabulary_id)

    return MessageOutput(message="Vocabulary deleted")

@router.get("/{vocabulary_id}/download", response_class=StreamingResponse)
def download_vocabulary_csv(vocabulary_id: int, db: Session = Depends(get_session)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found")

    concepts = vocab_db.concepts

    if not concepts:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No concepts found for this vocabulary")

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
        headers={"Content-Disposition": f"attachment; filename={vocab_db.name}.csv"}
    )


# ================================================
# Concepts routes
# ================================================

@router.post("/{vocabulary_id}/concepts", response_model=MessageOutput, status_code=status.HTTP_201_CREATED)
def add_concept(vocabulary_id: int, concept: ConceptCreate, db: Session = Depends(get_session)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found")

    concept_db = Concept(
        vocabulary_id=vocabulary_id,
        vocab_term_id=concept.vocab_term_id,
        vocab_term_name=concept.vocab_term_name
    )
    db.add(concept_db)
    db.commit()
    db.refresh(concept_db)

    indexer.add_concept_to_index(vocabulary_id, concept_db)

    return MessageOutput(message="Concept added")

@router.get("/{vocabulary_id}/concepts", response_model=List[Concept])
def get_concepts(vocabulary_id: int, db: Session = Depends(get_session)):
    vocab_db = db.get(Vocabulary, vocabulary_id)
    if vocab_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found")

    return vocab_db.concepts

@router.get("/{vocabulary_id}/concepts/{concept_id}", response_model=Concept)
def get_concept(vocabulary_id: int, concept_id: int, db: Session = Depends(get_session)):
    statement = (
        select(Concept)
        .where(Concept.vocabulary_id == vocabulary_id)
        .where(Concept.id == concept_id)
    )
    concept_db = db.exec(statement).one_or_none()

    if concept_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Concept not found")

    return concept_db

@router.delete("/{vocabulary_id}/concepts/{concept_id}", response_model=MessageOutput)
def delete_concept(vocabulary_id: int, concept_id: int, db: Session = Depends(get_session)):
    statement = (
        select(Concept)
        .where(Concept.vocabulary_id == vocabulary_id)
        .where(Concept.id == concept_id))
    concept_db = db.exec(statement).one_or_none()

    if concept_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Concept not found")

    db.delete(concept_db)
    db.commit()

    indexer.delete_concept_from_index(vocabulary_id, concept_id)

    return MessageOutput(message="Concept deleted")