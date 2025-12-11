from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.database import (
    get_session,
    Concept,
    Record,
    SourceTerm,
    SourceToConceptMap,
    User,
    Cluster,
)
from app.routes.v1.auth import get_current_user
from app.schemas import (
    MessageOutput,
    MapRequest,
    SourceTermOutput,
    ConceptsOutput,
)
from app.library.concept_indexer import indexer

# ================================================
# Helper functions
# ================================================


def verify_record_ownership(record: Record, user_id: int):
    """Verify that the user owns the dataset containing this record."""
    if record.dataset.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this record",
        )


def verify_cluster_ownership(cluster: Cluster, user_id: int):
    """Verify that the user owns the cluster."""
    if cluster.dataset.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this cluster",
        )


# ================================================
# Route definitions
# ================================================

router = APIRouter()


@router.get(
    "/{term_id}",
    response_model=SourceTermOutput,
    status_code=status.HTTP_200_OK,
    summary="Get a specific source term",
    description="Retrieves a single source term by its ID",
    response_description="The requested source term",
)
def get_source_term(
    term_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    source_term = db.get(SourceTerm, term_id)
    if source_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )

    # Verify ownership through record -> dataset -> user
    verify_record_ownership(source_term.record, current_user.id)

    return SourceTermOutput(source_term=source_term)


@router.delete(
    "/{term_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Delete a source term",
    description="Deletes a specific source term",
    response_description="Confirmation message that the source term was deleted successfully",
)
def delete_source_term(
    term_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    source_term = db.get(SourceTerm, term_id)
    if source_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )

    # Verify ownership through record -> dataset -> user
    verify_record_ownership(source_term.record, current_user.id)

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
    term_id: int,
    alternative_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    source_term = db.get(SourceTerm, term_id)
    if source_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )
    verify_record_ownership(source_term.record, current_user.id)

    alternative_term = db.get(SourceTerm, alternative_id)
    if alternative_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alternative term not found"
        )
    verify_record_ownership(alternative_term.record, current_user.id)

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
    term_id: int,
    request: MapRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Map the source term to the vocabulary concepts"""

    source_term = db.get(SourceTerm, term_id)
    if source_term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )
    verify_record_ownership(source_term.record, current_user.id)

    concept_ids = indexer.es_map_term_to_concept(source_term, request.vocabulary_ids)

    statement = select(Concept).where(Concept.id.in_(concept_ids))
    results = db.exec(statement)

    concept_map = {concept.id: concept for concept in results}
    ordered_results = [
        concept_map[concept_id]
        for concept_id in concept_ids
        if concept_id in concept_map
    ]

    return ConceptsOutput(concepts=ordered_results)


@router.post(
    "/{term_id}/map/{concept_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create source term to concept mapping",
    description="Creates a mapping relationship between a source term and a concept",
    response_description="Confirmation message that the mapping was created successfully",
)
def create_mapping(
    term_id: int,
    concept_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
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
    verify_record_ownership(source_term.record, current_user.id)

    # add the mapping to the database
    source_to_concept_map = SourceToConceptMap(
        source_term_id=term_id, concept_id=concept_id
    )
    db.add(source_to_concept_map)
    db.commit()

    return MessageOutput(message="Mapping created successfully")


# ================================================
# Cluster assignment routes
# ================================================


@router.post("/{term_id}/assign-cluster/{cluster_id}", response_model=MessageOutput)
def assign_term_to_cluster(
    term_id: int,
    cluster_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Manually assign a SourceTerm to a cluster.
    """

    term = db.get(SourceTerm, term_id)
    cluster = db.get(Cluster, cluster_id)

    if not term:
        raise HTTPException(status_code=404, detail=f"SourceTerm {term_id} not found")
    if not cluster:
        raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")

    # Verify ownership through term -> record -> dataset -> user
    record = db.get(Record, term.record_id)
    if not record:
        raise HTTPException(
            status_code=404, detail=f"Record {term.record_id} not found"
        )
    verify_record_ownership(record, current_user.id)
    verify_cluster_ownership(cluster, current_user.id)

    term.cluster_id = cluster.id
    db.add(term)
    db.commit()

    return MessageOutput(
        message=f"SourceTerm {term_id} assigned to cluster {cluster_id}"
    )


@router.post("/{term_id}/unassign-cluster", response_model=MessageOutput)
def unassign_term_from_cluster(
    term_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Remove SourceTerm from its cluster (cluster_id = NULL).
    """

    term = db.get(SourceTerm, term_id)
    if not term:
        raise HTTPException(404, "SourceTerm not found")

    # Verify ownership through term -> record -> dataset -> user
    record = db.get(Record, term.record_id)
    if not record:
        raise HTTPException(404, "Record not found")
    verify_record_ownership(record, current_user.id)

    term.cluster_id = None
    db.add(term)
    db.commit()

    return MessageOutput(message=f"SourceTerm {term_id} unassigned from cluster")
