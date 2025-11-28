import io
import csv
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.core.database import get_session, Vocabulary, Concept
from app.models import (
    ConceptCreate,
    MessageOutput,
    VocabularyCreate,
    ConceptsOutput,
    VocabulariesOutput,
    VocabularyOutput,
    ConceptOutput,
)
from app.library.concept_indexer import indexer

# ================================================
# Route definitions
# ================================================

router = APIRouter()

# ================================================
# Vocabularies routes
# ================================================


@router.post(
    "/",
    response_model=MessageOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new vocabulary",
    description="Creates a new vocabulary with its concepts and indexes them in Elasticsearch for semantic search",
    response_description="Confirmation message that the vocabulary was created successfully",
)
def create_vocabulary(vocab: VocabularyCreate, db: Session = Depends(get_session)):
    vocabulary = Vocabulary(name=vocab.name, version=vocab.version)
    db.add(vocabulary)
    db.commit()
    db.refresh(vocabulary)
    vocabulary_id = vocabulary.id

    # NEED TO CREATE NEW ES ALSO
    indexer.create_concept_index(vocabulary_id)

    for c in vocab.concepts:
        concept = Concept(
            vocabulary_id=vocabulary_id,
            vocab_term_id=c.vocab_term_id,
            vocab_term_name=c.vocab_term_name,
        )
        db.add(concept)
    db.commit()  # Might use db.flush() to commit and generate the ID for the concepts

    for c in vocabulary.concepts:
        db.refresh(c)
    db.refresh(vocabulary)

    # NEED TO ADD CONCEPTS TO INDEX
    indexer.add_bulk_to_index(vocabulary_id, vocabulary.concepts)

    return MessageOutput(message="Vocabulary created successfully")


@router.get(
    "/",
    response_model=VocabulariesOutput,
    status_code=status.HTTP_200_OK,
    summary="List all vocabularies",
    description="Retrieves a list of all vocabularies in the system",
    response_description="List of vocabularies with their metadata",
)
def get_vocabularies(db: Session = Depends(get_session)):
    vocabularies = db.exec(select(Vocabulary)).all()
    return VocabulariesOutput(vocabularies=vocabularies)


@router.get(
    "/{vocabulary_id}",
    response_model=VocabularyOutput,
    status_code=status.HTTP_200_OK,
    summary="Get a specific vocabulary",
    description="Retrieves a single vocabulary by its ID",
    response_description="The requested vocabulary with its metadata",
)
def get_vocabulary(vocabulary_id: int, db: Session = Depends(get_session)):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )

    return VocabularyOutput(vocabulary=vocabulary)


@router.delete(
    "/{vocabulary_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Delete a vocabulary",
    description="Deletes a vocabulary, its concepts, and removes it from the Elasticsearch index",
    response_description="Confirmation message that the vocabulary was deleted successfully",
)
def delete_vocabulary(vocabulary_id: int, db: Session = Depends(get_session)):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )

    db.delete(vocabulary)
    db.commit()

    indexer.delete_index(vocabulary_id)

    return MessageOutput(message="Vocabulary deleted successfully")


@router.get(
    "/{vocabulary_id}/download",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
    summary="Download vocabulary",
    description="Downloads a vocabulary's concepts as a file",
    response_description="The file containing the vocabulary concepts",
)
def download_vocabulary_csv(vocabulary_id: int, fomrat: str = "csv", db: Session = Depends(get_session)):
    # TODO: enable vocabulary download as JSON or CSV (?format=json or ?format=csv, where csv is the default)

    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )

    concepts = vocabulary.concepts

    if not concepts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No concepts found for this vocabulary",
        )

    # TODO: make a separate function for this
    # FIX: the solution below does not parse the text correctly. There should be
    #      one column containing the whole text (parsed accordingly) - newlines
    #      should be properly handled (i.e. "Text text\n\ntext text" in a single line).
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["vocab_term_id", "vocab_term_name"])
    writer.writeheader()
    for c in concepts:
        # TODO: add other fields (description, synonyms, etc.)
        writer.writerow(
            {"vocab_term_id": c.vocab_term_id, "vocab_term_name": c.vocab_term_name}
        )
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={vocabulary.name}.csv"},
    )


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
def get_concepts(vocabulary_id: int, db: Session = Depends(get_session)):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )

    return ConceptsOutput(concepts=vocabulary.concepts)


@router.post(
    "/{vocabulary_id}/concepts",
    response_model=MessageOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Add a concept to a vocabulary",
    description="Creates a new concept and adds it to the specified vocabulary and its Elasticsearch index",
    response_description="Confirmation message that the concept was added successfully",
)
def add_concept(
    vocabulary_id: int, concept: ConceptCreate, db: Session = Depends(get_session)
):
    vocabulary = db.get(Vocabulary, vocabulary_id)
    if vocabulary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found"
        )

    concept = Concept(
        vocabulary_id=vocabulary_id,
        vocab_term_id=concept.vocab_term_id,
        vocab_term_name=concept.vocab_term_name,
    )
    db.add(concept)
    db.commit()
    db.refresh(concept)

    indexer.add_concept_to_index(vocabulary_id, concept)

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
    vocabulary_id: int, concept_id: int, db: Session = Depends(get_session)
):
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
    vocabulary_id: int, concept_id: int, db: Session = Depends(get_session)
):
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
