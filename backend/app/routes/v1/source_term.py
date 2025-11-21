from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.database import get_session, Concept, Record, SourceTerm, SourceToConceptMap
from app.models import MessageOutput, SourceTermCreate, MapRequest
from app.library.concept_indexer import indexer

# ================================================
# Route definitions
# ================================================

router = APIRouter()

@router.post("/{record_id}", response_model=MessageOutput, status_code=status.HTTP_201_CREATED)
def create_source_term(record_id: int, term: SourceTermCreate, db: Session = Depends(get_session)):
    record = db.get(Record, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    term_db = SourceTerm(
        record_id=record_id,
        value=term.value,
        label=term.label
    )
    db.add(term_db)
    db.commit()
    return MessageOutput(message="Source term created")

@router.get("/{record_id}", response_model=List[SourceTerm])
def get_source_terms(record_id: int, db: Session = Depends(get_session)):
    record = db.get(Record, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    return record.source_terms

@router.get("{record_id}/{term_id}", response_model=SourceTerm)
def get_source_term(record_id: int, term_id: str, db: Session = Depends(get_session)):
    statement = (
        select(SourceTerm)
        .where(SourceTerm.id == term_id)
        .where(SourceTerm.record_id == record_id)
    )
    term_db = db.exec(statement).one_or_none()

    if term_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found")

    return term_db

@router.delete("{record_id}/{term_id}", response_model=MessageOutput)
def delete_source_term(record_id: int, term_id: str, db: Session = Depends(get_session)):
    statement = (
        select(SourceTerm)
        .where(SourceTerm.id == term_id)
        .where(SourceTerm.record_id == record_id)
    )
    term_db = db.exec(statement).one_or_none()

    if term_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found")
    db.delete(term_db)
    db.commit()

    return MessageOutput(message="Source term deleted")

@router.put("{term_id}/alternative/{alternative_id}", response_model=MessageOutput)
def add_alternative(term_id: int, alternative_id: int, db: Session = Depends(get_session)):
    term_db = db.get(SourceTerm, term_id)
    if term_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found")

    alt_db = db.get(SourceTerm, alternative_id)
    if alt_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alternative term not found")

    term_db.alternative_id = alternative_id
    db.commit()

    return MessageOutput(message="Source term alternative updated")

# @router.get("/download", response_model=StreamingResponse)
# def download_source_terms_csv(db: Session = Depends(get_session)):
#     pass

@router.post("/{term_id}/map", response_model=List[Concept])
def map_term_to_concept(term_id: int, request: MapRequest, db: Session = Depends(get_session)):
    """Map the source term to the vocabulary concepts"""

    term_db = db.get(SourceTerm, term_id)
    if term_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found")

    concept_ids = indexer.es_map_term_to_concept(term_db, request.vocabulary_ids)

    statement = select(Concept).where(Concept.id.in_(concept_ids))
    results = db.exec(statement)

    concept_map = {concept.id: concept for concept in results}
    ordered_results = [concept_map[concept_id] for concept_id in concept_ids if concept_id in concept_map]

    return ordered_results

@router.post("/{term_id}/map/{concept_id}", response_model=MessageOutput)
def create_mapping(term_id: int, concept_id: int, db: Session = Depends(get_session)):

    concept_db = db.get(Concept, concept_id)
    if concept_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Concept not found")

    term_db = db.get(SourceTerm, term_id)
    if term_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found")

    # add the mapping to the database
    map_db = SourceToConceptMap(
        source_term_id=term_id,
        concept_id=concept_id
    )
    db.add(map_db)
    db.commit()

    return MessageOutput(message="Mapping created")


# TODO: add function to retrive the mappings