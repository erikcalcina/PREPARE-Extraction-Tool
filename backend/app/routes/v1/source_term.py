from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.database import (
    get_session,
    Concept,
    Record,
    SourceTerm,
    SourceToConceptMap,
)
from app.models import MessageOutput, SourceTermCreate, MapRequest
from app.library.concept_indexer import indexer

# ================================================
# Route definitions
# ================================================

router = APIRouter()


@router.post(
    "/{record_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create a source term",
    description="Creates a new source term associated with a specific record",
    response_description="Confirmation message that the source term was created successfully",
)
def create_source_term(
    record_id: int, term: SourceTermCreate, db: Session = Depends(get_session)
):
    record = db.get(Record, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    source_term = SourceTerm(record_id=record_id, value=term.value, label=term.label)
    db.add(source_term)
    db.commit()
    return MessageOutput(message="Source term created successfully")


@router.get(
    "/{record_id}",
    response_model=List[SourceTerm],
    status_code=status.HTTP_200_OK,
    summary="List all source terms for a record",
    description="Retrieves all source terms associated with a specific record",
    response_description="List of source terms in the record",
)
def get_source_terms(record_id: int, db: Session = Depends(get_session)):
    record = db.get(Record, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    return {"source_terms": record.source_terms}


@router.get(
    "/{record_id}/{term_id}",
    response_model=SourceTerm,
    status_code=status.HTTP_200_OK,
    summary="Get a specific source term",
    description="Retrieves a single source term by its ID from a specific record",
    response_description="The requested source term",
)
def get_source_term(record_id: int, term_id: str, db: Session = Depends(get_session)):
    statement = (
        select(SourceTerm)
        .where(SourceTerm.id == term_id)
        .where(SourceTerm.record_id == record_id)
    )
    source_term = db.exec(statement).one_or_none()

    if source_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )

    return {"source_term": source_term}


@router.delete(
    "/{record_id}/{term_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Delete a source term",
    description="Deletes a specific source term from a record",
    response_description="Confirmation message that the source term was deleted successfully",
)
def delete_source_term(
    record_id: int, term_id: str, db: Session = Depends(get_session)
):
    statement = (
        select(SourceTerm)
        .where(SourceTerm.id == term_id)
        .where(SourceTerm.record_id == record_id)
    )
    source_term = db.exec(statement).one_or_none()

    if source_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )
    db.delete(source_term)
    db.commit()

    return MessageOutput(message="Source term deleted successfully")


@router.put(
    "/{term_id}/alternative/{alternative_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Set alternative source term",
    description="Links an alternative source term to the specified source term",
    response_description="Confirmation message that the alternative was linked successfully",
)
def add_alternative(
    term_id: int, alternative_id: int, db: Session = Depends(get_session)
):
    source_term = db.get(SourceTerm, term_id)
    if source_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )

    alternative_term = db.get(SourceTerm, alternative_id)
    if alternative_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alternative term not found"
        )

    source_term.alternative_id = alternative_id
    db.commit()

    return MessageOutput(message="Source term alternative updated successfully")


# @router.get("/download", response_model=StreamingResponse)
# def download_source_terms_csv(db: Session = Depends(get_session)):
#     pass


@router.post(
    "/{term_id}/map",
    response_model=List[Concept],
    status_code=status.HTTP_200_OK,
    summary="Map source term to concepts",
    description="Maps a source term to vocabulary concepts using semantic search and returns matching concepts ordered by relevance",
    response_description="List of concepts that match the source term, ordered by relevance",
)
def map_term_to_concept(
    term_id: int, request: MapRequest, db: Session = Depends(get_session)
):
    """Map the source term to the vocabulary concepts"""

    source_term = db.get(SourceTerm, term_id)
    if source_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )

    concept_ids = indexer.es_map_term_to_concept(source_term, request.vocabulary_ids)

    statement = select(Concept).where(Concept.id.in_(concept_ids))
    results = db.exec(statement)

    concept_map = {concept.id: concept for concept in results}
    ordered_results = [
        concept_map[concept_id]
        for concept_id in concept_ids
        if concept_id in concept_map
    ]

    return {"concepts": ordered_results}


@router.post(
    "/{term_id}/map/{concept_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create source term to concept mapping",
    description="Creates a mapping relationship between a source term and a concept",
    response_description="Confirmation message that the mapping was created successfully",
)
def create_mapping(term_id: int, concept_id: int, db: Session = Depends(get_session)):

    concept = db.get(Concept, concept_id)
    if concept is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Concept not found"
        )

    source_term = db.get(SourceTerm, term_id)
    if source_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )

    # add the mapping to the database
    source_to_concept_map = SourceToConceptMap(
        source_term_id=term_id, concept_id=concept_id
    )
    db.add(source_to_concept_map)
    db.commit()

    return MessageOutput(message="Mapping created successfully")


# TODO: add function to retrive the mappings
