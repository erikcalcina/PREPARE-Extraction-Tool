import io
import csv
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func, update

from app.core.database import engine, get_session, Vocabulary, Concept, User
from app.library.file_parser import parse_concepts_file
from app.models_db import VocabularyStatus
from app.routes.v1.auth import get_current_user
from app.schemas import (
    MessageOutput,
    VocabularyResponse,
    VocabulariesOutput,
    VocabularyUploadResponse,
    VocabularyOutput,
    ProcessingVocabularyStats,
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

    # Subquery for concept counts grouped by vocabulary_id
    concept_counts_subquery = (
        select(
            Concept.vocabulary_id,
            func.count(Concept.id).label("count")
        )
        .group_by(Concept.vocabulary_id)
        .subquery()
    )

    # Get paginated vocabularies with concept counts in a single query
    vocabularies_with_counts = db.exec(
        select(
            Vocabulary,
            func.coalesce(concept_counts_subquery.c.count, 0).label("concept_count")
        )
        .outerjoin(
            concept_counts_subquery,
            Vocabulary.id == concept_counts_subquery.c.vocabulary_id
        )
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
            concept_count=concept_count,
            status=vocabulary.status,
            error_message=vocabulary.error_message
        )
        for vocabulary, concept_count in vocabularies_with_counts
    ]

    return VocabulariesOutput(
        vocabularies=vocabulary_responses,
        pagination=create_pagination_metadata(
            total, pagination.limit, pagination.offset
        ),
    )

@router.post(
    "/",
    response_model=VocabularyUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a new vocabulary",
    description="Creates a new vocabulary with its concepts and indexes them in Elasticsearch for semantic search",
    response_description="Confirmation message that the vocabulary was created successfully",
)
async def create_vocabulary(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type.",
        )

    # save file to disk
    file_path = await save_upload_to_disk(file)

    # start background ingestion
    background_tasks.add_task(
        ingest_vocabulary_background,
        file_path,
        current_user.id
    )
    
    vocabulary_response = VocabularyUploadResponse(
        status=VocabularyStatus.PENDING,
        message="Concept upload successfully started background task"
    )
    return vocabulary_response

async def save_upload_to_disk(file: UploadFile) -> str:
    path = f"/tmp/{uuid4()}.csv"

    with open(path, "wb") as out:
        # read 1 MB at a time
        while chunk := await file.read(1024 * 1024):
            out.write(chunk)

    return path

def ingest_vocabulary_background(file_path: str, user_id: int):
    db = Session(engine)

    REQUIRED_COLUMNS = [
        "concept_id",
        "concept_name",
        "domain_id",
        "vocabulary_id",
        "concept_class_id",
        "standard_concept",
        "concept_code",
        "valid_start_date",
        "valid_end_date",
        "invalid_reason",
    ]

    UNWANTED_IDS = ['Korean Revenue Code', 'Cost Type', 'UB04 Pt dis status', 'Observation Type', 
            'Concept Class', 'UB04 Pri Typ of Adm', 'Visit Type', 'Sponsor', 'Relationship', 
            'SOPT', 'Meas Type', 'US Census', 'Language', 'Note Type', 'Condition Status', 
            'Procedure Type', 'Vocabulary', 'Obs Period Type', 'Type Concept', 'Plan Stop Reason', 
            'UCUM', 'CDM', 'Metadata', 'OSM', 'Plan', 'UB04 Point of Origin', 'Cost', 'UB04 Typ bill', 
            'Episode', 'Death Type', 'Condition Type', 'Device Type', 'Drug Type', 'Visit', 'Domain', "None"]

    vocabularies = {}
    try:

        # start ingesting
        BATCH_SIZE = 2000
        batch = []
        total = 0
        for concept, vocab_name in parse_concepts_file(file_path, REQUIRED_COLUMNS, UNWANTED_IDS):
            if vocab_name in vocabularies.keys():
                concept.vocabulary_id = vocabularies[vocab_name]
            else:
                # create a new Vocabulary
                vocabulary = Vocabulary(name=vocab_name, user_id=user_id)
                db.add(vocabulary)
                db.commit()
                db.refresh(vocabulary)
                vocab_id = vocabulary.id
                concept.vocabulary_id = vocab_id
                # create new ES index also
                indexer.create_concept_index(vocab_id)
                vocabularies[vocab_name] = vocab_id

            batch.append(concept)

            if len(batch) >= BATCH_SIZE:
                db.bulk_save_objects(batch, return_defaults=True)
                db.commit()
                total += len(batch)
                indexer.add_bulk_to_index(batch)
                batch.clear()
                print("Rows saved:", total)

        if batch:
            db.bulk_save_objects(batch, return_defaults=True)
            db.commit()
            total += len(batch)
            indexer.add_bulk_to_index(batch)
            print("Rows saved:", total, "-> ALL")

        # success
        vocab_ids = list(vocabularies.values())
        db.exec(
            update(Vocabulary)
            .where(Vocabulary.id.in_(vocab_ids))
            .values(status=VocabularyStatus.DONE)
        )
        db.commit()

    except Exception as e:
        import traceback
        traceback.print_exc()
        # failure cleanup
        db.rollback()

        vocab_ids = list(vocabularies.values())
        error_msg = str(e)

        if vocab_ids:
            # mark all vocabularies as FAILED
            db.exec(
                update(Vocabulary)
                .where(Vocabulary.id.in_(vocab_ids))
                .values(
                    status=VocabularyStatus.FAILED,
                    error_message=error_msg
                )
            )
            db.commit()

            # delete ES indices
            for vocab_id in vocab_ids:
                try:
                    indexer.delete_index(vocab_id)
                except Exception as es_err:
                    print(f"Failed to delete ES index for vocab {vocab_id}: {es_err}")

    finally:
        db.close()

@router.get(
    "/processing/stats",
    response_model=ProcessingVocabularyStats,
    status_code=status.HTTP_200_OK,
    summary="Get processing vocabulary stats",
    description="Returns the number of vocabularies in PROCESSING state and the total number of uploaded concepts",
)
def get_processing_vocabulary_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    # count vocabularies in PROCESSING
    vocab_count = db.exec(
        select(func.count(Vocabulary.id))
        .where(
            Vocabulary.user_id == current_user.id,
            Vocabulary.status == VocabularyStatus.PROCESSING,
        )
    ).one()

    # sum concepts across those vocabularies
    concept_count = db.exec(
        select(func.count(Concept.id))
        .join(Vocabulary, Concept.vocabulary_id == Vocabulary.id)
        .where(
            Vocabulary.user_id == current_user.id,
            Vocabulary.status == "PROCESSING",
        )
    ).one()

    return ProcessingVocabularyStats(
        processing_vocabularies=vocab_count or 0,
        total_concepts=concept_count or 0,
    )


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
        concept_count=db.exec(
            select(func.count(Concept.id))
            .where(Concept.vocabulary_id == vocabulary.id)
        ).one(),
        status=vocabulary.status,
        error_message=vocabulary.error_message
    )
    return VocabularyOutput(vocabulary=vocabulary_response)


@router.delete(
    "/{vocabulary_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete a vocabulary",
    description="Deletes a vocabulary, its concepts, and removes it from the Elasticsearch index",
    response_description="Confirmation message that the vocabulary deletion started",
)
def delete_vocabulary(
    background_tasks: BackgroundTasks,
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
    vocabulary.status = VocabularyStatus.DELETED
    db.commit()

    # start background ingestion
    background_tasks.add_task(
        delete_vocabulary_background,
        vocabulary_id
    )

    return MessageOutput(message="Vocabulary deletion started in the background")

def delete_vocabulary_background(vocabulary_id: int):
    db = Session(engine)
    try:
        vocabulary = db.get(Vocabulary, vocabulary_id)
        if vocabulary is None:
            print(f"Vocabulary {vocabulary_id} not found during background deletion")
            return 

        # delete from database
        db.delete(vocabulary)
        db.commit()

        # delete from Elasticsearch
        indexer.delete_index(vocabulary_id)
        
        print(f"Successfully deleted vocabulary {vocabulary_id}")
        
    except Exception as e:
        db.rollback()
        print(f"Failed to delete vocabulary {vocabulary_id}: {e}")
    finally:
        db.close()


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
