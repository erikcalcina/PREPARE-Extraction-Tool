import re
from math import ceil
from datetime import datetime
from typing import List, Optional, Dict

from fastapi import Query
from pydantic import BaseModel, Field, field_validator
from app.models_db import Record, Concept, SourceTerm


# ================================================
# Generic response models
# ================================================


class MessageOutput(BaseModel):
    """Generic message response for simple API responses."""

    message: str


# ================================================
# Pagination models
# ================================================


class PaginationMetadata(BaseModel):
    """Metadata for paginated responses."""

    total: int
    limit: int
    offset: int
    page: int
    total_pages: int


class PaginationParams:
    """Dependency for pagination query parameters."""

    def __init__(
        self,
        limit: int = Query(50, ge=1, description="Number of items per page"),
        offset: int = Query(0, ge=0, description="Number of items to skip"),
        page: Optional[int] = Query(
            None, ge=1, description="Page number (overrides offset)"
        ),
    ):
        # Calculate offset from page if provided
        if page is not None:
            self.offset = (page - 1) * limit
            self.page = page
        else:
            self.offset = offset
            self.page = (offset // limit) + 1 if limit > 0 else 1

        self.limit = limit


def create_pagination_metadata(
    total: int, limit: int, offset: int
) -> PaginationMetadata:
    """Helper function to create pagination metadata."""
    current_page = (offset // limit) + 1 if limit > 0 else 1
    total_pages = ceil(total / limit) if limit > 0 else 0

    return PaginationMetadata(
        total=total,
        limit=limit,
        offset=offset,
        page=current_page,
        total_pages=total_pages,
    )


# ================================================
# User models
# ================================================


class UserModel(BaseModel):
    """Base user model for internal use."""

    username: str
    disabled: bool = False


class UserRegister(BaseModel):
    """Model for user registration with validation."""

    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username contains only alphanumeric characters and underscores."""
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError(
                "Username must contain only letters, numbers, and underscores"
            )
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password meets complexity requirements."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        # Check for at least one uppercase, one lowercase, and one digit
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")

        return v


class UserResponse(BaseModel):
    """Model for user API responses (excludes sensitive data)."""

    id: int
    username: str
    disabled: bool
    created_at: datetime
    last_login: Optional[datetime] = None


class UserStatsResponse(BaseModel):
    """Model for user statistics response."""

    dataset_count: int
    vocabulary_count: int


# ================================================
# Dataset models
# ================================================


class DatasetCreate(BaseModel):
    """Model for creating a new dataset with optional records."""

    name: str
    labels: List[str] = Field(default_factory=list)
    records: List["RecordCreate"] = Field(default_factory=list)


class DatasetResponse(BaseModel):
    """Model for dataset API responses with metadata."""

    id: int
    name: str
    uploaded: datetime
    last_modified: datetime
    labels: List[str]
    record_count: int


class DatasetOutput(BaseModel):
    """Wrapper for single dataset response."""

    dataset: DatasetResponse


class DatasetsOutput(BaseModel):
    """Wrapper for paginated list of datasets."""

    datasets: List[DatasetResponse]
    pagination: PaginationMetadata


class DatasetStatsResponse(BaseModel):
    """Model for dataset statistics."""

    total_records: int
    processed_count: int
    pending_review_count: int
    extracted_terms_count: int


# ================================================
# Record models
# ================================================


class RecordCreate(BaseModel):
    """Model for creating a new record (source term)."""

    patient_id: str
    seq_number: Optional[str] = None
    date: Optional[datetime] = None
    text: str


class RecordResponse(BaseModel):
    """Model for record API responses with metadata."""

    id: int
    patient_id: str
    seq_number: Optional[str] = None
    date: Optional[datetime] = None
    text: str
    uploaded: datetime
    dataset_id: int
    reviewed: bool
    source_term_count: int = 0


class RecordOutput(BaseModel):
    """Wrapper for single record response."""

    record: Record


class RecordsOutput(BaseModel):
    """Wrapper for paginated list of records."""

    records: List[RecordResponse]
    pagination: PaginationMetadata


# ================================================
# Vocabulary models
# ================================================


class VocabularyCreate(BaseModel):
    """Model for creating a new vocabulary with concepts."""

    name: str
    version: str
    concepts: List["ConceptCreate"] = Field(default_factory=list)


class VocabularyResponse(BaseModel):
    """Model for vocabulary API responses with metadata."""

    id: int
    name: str
    uploaded: datetime
    version: str
    concept_count: int


class VocabularyOutput(BaseModel):
    """Wrapper for single vocabulary response."""

    vocabulary: VocabularyResponse


class VocabulariesOutput(BaseModel):
    """Wrapper for paginated list of vocabularies."""

    vocabularies: List[VocabularyResponse]
    pagination: PaginationMetadata


# ================================================
# Concept models
# ================================================


class ConceptCreate(BaseModel):
    """Model for creating a new concept within a vocabulary."""

    vocab_term_id: str
    vocab_term_name: str
    domain_id: str
    concept_class_id: str
    standard_concept: Optional[str] = None
    concept_code: Optional[str] = None
    valid_start_date: datetime
    valid_end_date: datetime
    invalid_reason: Optional[str] = None


class ConceptOutput(BaseModel):
    """Wrapper for single concept response."""

    concept: Concept


class ConceptsOutput(BaseModel):
    """Wrapper for paginated list of concepts."""

    concepts: List[Concept]


# ================================================
# Source term models
# ================================================


class SourceTermCreate(BaseModel):
    """Model for creating a source term."""

    value: str
    label: str
    start_position: Optional[int] = None
    end_position: Optional[int] = None


class SourceTermOutput(BaseModel):
    """Wrapper for single source term response."""

    source_term: SourceTerm


class SourceTermsOutput(BaseModel):
    """Wrapper for paginated list of source terms."""

    source_terms: List[SourceTerm]
    pagination: PaginationMetadata


# ================================================
# Mapping models
# ================================================


class MapRequest(BaseModel):
    """Request model for mapping source terms to vocabularies."""

    vocabulary_ids: List[int]


# TODO: check if this should be a SQLModel table or only a Pydantic model
# This is a Pydantic model because it is not stored in the database. We only use it to return structured JSON to the frontend.
# The real data in the dstabase is stored in the Cluster and SourceTerm tables.
# ClusteredTerm and EntityCluster are just response objects, created in memory.
# So they should be Pydantic models, not SQLModel tables.
class ClusteredTerm(BaseModel):
    term_id: int
    text: str
    frequency: int
    n_records: int
    record_ids: List[int]


class EntityCluster(BaseModel):
    id: int
    main_term: str
    label: str
    total_terms: int
    total_occurrences: int
    n_records: int
    terms: List[ClusteredTerm]


# ================================================
# Clustering response models
# ================================================


class ClusterResponse(BaseModel):
    """Rich cluster data for frontend display"""

    id: int
    dataset_id: int
    label: str
    title: str
    total_terms: int
    total_occurrences: int
    unique_records: int
    terms: List[ClusteredTerm]


class ClustersOutput(BaseModel):
    """Complete clustering state for a dataset/label"""

    clusters: List[ClusterResponse]
    unclustered_terms: List[ClusteredTerm]
    total_terms: int
    labels: List[str]


class ClusterCreateRequest(BaseModel):
    """Create new empty cluster manually"""

    label: str
    title: str


class ClusterMergeRequest(BaseModel):
    """Merge multiple clusters"""

    cluster_ids: List[int] = Field(min_length=2)
    new_title: str


class BatchAssignRequest(BaseModel):
    """Bulk term assignments"""

    assignments: List[Dict[str, int]]
