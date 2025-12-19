import io
import csv

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func, text

from app.core.database import get_session, Vocabulary, Concept, User
from app.library.file_parser import parse_concepts_file
from app.routes.v1.auth import get_current_user
from app.schemas import (
    MessageOutput,
    VocabularyCreate,
    VocabularyResponse,
    VocabulariesOutput,
    VocabularyOutput,
    ConceptCreate,
    ConceptsOutput,
    ConceptOutput,
    PaginationParams,
    create_pagination_metadata,
)
from app.library.concept_indexer import indexer

# ================================================
# Route definitions
# ================================================

router = APIRouter()


# ================================================
# Helper functions
# ================================================


def verify_vocabulary_ownership(vocabulary: Vocabulary, user_id: int):
    """Verify that the user owns the vocabulary."""
    if vocabulary.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this vocabulary",
        )


# ================================================
# Vocabularies routes
# ================================================


@router.get(
    "/",
    response_model=VocabulariesOutput,
    status_code=status.HTTP_200_OK,
    summary="List all vocabularies",
    description="Retrieves a list of all vocabularies owned by the authenticated user",
    response_description="List of vocabularies with their metadata",
)
def get_vocabularies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
    pagination: PaginationParams = Depends(),
):
    # Get total count
    total = db.exec(
        select(func.count())
        .select_from(Vocabulary)
        .where(Vocabulary.user_id == current_user.id)
    ).one()

    # Get paginated vocabularies
    vocabularies = db.exec(
        select(Vocabulary)
        .where(Vocabulary.user_id == current_user.id)
        .order_by(Vocabulary.id)
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    
    vocabulary_responses = [
        VocabularyResponse(
            id=vocabulary.id,
            name=vocabulary.name,
            uploaded=vocabulary.uploaded,
            version=vocabulary.version,
            concept_count=db.query(
                func.count(Concept.id))
                .filter(Concept.vocabulary_id == vocabulary.id)
                .scalar()
        )
        for vocabulary in vocabularies
    ]

    return VocabulariesOutput(
        vocabularies=vocabulary_responses,
        pagination=create_pagination_metadata(
            total, pagination.limit, pagination.offset
        ),
    )

@router.post(
    "/",
    response_model=VocabularyOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new vocabulary",
    description="Creates a new vocabulary with its concepts and indexes them in Elasticsearch for semantic search",
    response_description="Confirmation message that the vocabulary was created successfully",
)
async def create_vocabulary(
    name: str = Form(...),
    version: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    REQUIRED_COLUMNS = [
        "concept_id",
        "concept_name",
        "domain_id",
        "concept_class_id",
        "standard_concept",
        "concept_code",
        "valid_start_date",
        "valid_end_date",
        "invalid_reason",
    ]

    # create a new Vocabulary
    vocabulary = Vocabulary(name=name, version=version, user_id=current_user.id)
    db.add(vocabulary)
    db.commit()
    db.refresh(vocabulary)
    vocabulary_id = vocabulary.id

    # create new ES index also
    indexer.create_concept_index(vocabulary_id)

    BATCH_SIZE = 2000
    batch = []
    total = 0
    async for concept in parse_concepts_file(file, REQUIRED_COLUMNS):
        concept.vocabulary_id = vocabulary_id
        batch.append(concept)

        if len(batch) >= BATCH_SIZE:
            db.bulk_save_objects(batch, return_defaults=True)
            db.commit()
            total += len(batch)
            indexer.add_bulk_to_index(vocabulary_id, batch)
            batch.clear()
            print("Rows saved:", total)

    if batch:
        db.bulk_save_objects(batch, return_defaults=True)
        db.commit()
        total += len(batch)
        indexer.add_bulk_to_index(vocabulary_id, batch)
        print("Rows saved:", total, "-> ALL")
    
    vocabulary_response = VocabularyResponse(
        id=vocabulary.id,
        name=vocabulary.name,
        uploaded=vocabulary.uploaded,
        version=vocabulary.version,
        concept_count=total,
    )
    return VocabularyOutput(vocabulary=vocabulary_response)


@router.get(
    "/{vocabulary_id}",
    response_model=VocabularyOutput,
    status_code=status.HTTP_200_OK,
    summary="Get a specific vocabulary",
    description="Retrieves a single vocabulary by its ID",
    response_description="The requested vocabulary with its metadata",
)
def get_vocabulary(
    vocabulary_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )
    verify_vocabulary_ownership(vocabulary, current_user.id)

    vocabulary_response = VocabularyResponse(
        id=vocabulary.id,
        name=vocabulary.name,
        uploaded=vocabulary.uploaded,
        version=vocabulary.version,
        concept_count=db.query(
            func.count(Concept.id))
            .filter(Concept.vocabulary_id == vocabulary.id)
            .scalar()
    )
    return VocabularyOutput(vocabulary=vocabulary_response)


@router.delete(
    "/{vocabulary_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Delete a vocabulary",
    description="Deletes a vocabulary, its concepts, and removes it from the Elasticsearch index",
    response_description="Confirmation message that the vocabulary was deleted successfully",
)
def delete_vocabulary(
    vocabulary_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )
    verify_vocabulary_ownership(vocabulary, current_user.id)

    db.delete(vocabulary)
    db.commit()

    indexer.delete_index(vocabulary_id)

    return MessageOutput(message="Vocabulary deleted successfully")


# ================================================
# Concepts routes
# ================================================


@router.get(
    "/{vocabulary_id}/concepts",
    response_model=ConceptsOutput,
    status_code=status.HTTP_200_OK,
    summary="List all concepts in a vocabulary",
    description="Retrieves all concepts belonging to a specific vocabulary",
    response_description="List of concepts in the vocabulary",
)
def get_concepts(
    vocabulary_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
    pagination: PaginationParams = Depends(),
):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )
    verify_vocabulary_ownership(vocabulary, current_user.id)

    # TODO: Search over Elasticsearch index if query parameters are provided
    # (query parameters must be added to the endpoint)
    # query parameters: text (for searching over concept names and alternatives), vocabulary_id (for searching over concepts in a specific vocabulary)

    # Get total count
    total = db.exec(
        select(func.count())
        .select_from(Concept)
        .where(Concept.vocabulary_id == vocabulary_id)
    ).one()

    # Get paginated concepts
    concepts = db.exec(
        select(Concept)
        .where(Concept.vocabulary_id == vocabulary_id)
        .order_by(Concept.id)
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()

    return ConceptsOutput(
        concepts=concepts,
        pagination=create_pagination_metadata(
            total, pagination.limit, pagination.offset
        ),
    )


@router.post(
    "/{vocabulary_id}/concepts",
    response_model=MessageOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Add a concept to a vocabulary",
    description="Creates a new concept and adds it to the specified vocabulary and its Elasticsearch index",
    response_description="Confirmation message that the concept was added successfully",
)
def add_concept(
    vocabulary_id: int,
    concept: ConceptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )
    verify_vocabulary_ownership(vocabulary, current_user.id)

    new_concept = Concept(
        vocabulary_id=vocabulary_id,
        vocab_term_id=concept.vocab_term_id,
        vocab_term_name=concept.vocab_term_name,
        domain_id=concept.vocab_term_name,
        concept_class_id=concept.concept_class_id,
        standard_concept=concept.standard_concept,
        concept_code=concept.concept_code,
        valid_start_date=concept.valid_start_date,
        valid_end_date=concept.valid_end_date,
        invalid_reason=concept.invalid_reason,
    )

    db.add(new_concept)
    db.commit()
    db.refresh(new_concept)

    indexer.add_concept_to_index(vocabulary_id, new_concept)

    return MessageOutput(message="Concept added successfully")


@router.get(
    "/{vocabulary_id}/concepts/{concept_id}",
    response_model=ConceptOutput,
    status_code=status.HTTP_200_OK,
    summary="Get a specific concept",
    description="Retrieves a single concept by its ID from a specific vocabulary",
    response_description="The requested concept",
)
def get_concept(
    vocabulary_id: int,
    concept_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )
    verify_vocabulary_ownership(vocabulary, current_user.id)

    statement = (
        select(Concept)
        .where(Concept.vocabulary_id == vocabulary_id)
        .where(Concept.id == concept_id)
    )
    concept = db.exec(statement).one_or_none()

    if concept is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Concept not found"
        )

    return ConceptOutput(concept=concept)


@router.delete(
    "/{vocabulary_id}/concepts/{concept_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Delete a concept",
    description="Deletes a specific concept from a vocabulary and removes it from the Elasticsearch index",
    response_description="Confirmation message that the concept was deleted successfully",
)
def delete_concept(
    vocabulary_id: int,
    concept_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )
    verify_vocabulary_ownership(vocabulary, current_user.id)

    statement = (
        select(Concept)
        .where(Concept.vocabulary_id == vocabulary_id)
        .where(Concept.id == concept_id)
    )
    concept = db.exec(statement).one_or_none()

    if concept is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Concept not found"
        )

    db.delete(concept)
    db.commit()

    indexer.delete_concept_from_index(vocabulary_id, concept_id)

    return MessageOutput(message="Concept deleted successfully")
