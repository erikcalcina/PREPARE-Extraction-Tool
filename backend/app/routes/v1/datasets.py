import csv
import io
from collections import defaultdict
from datetime import datetime, timezone

from typing import List, Dict

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func

from sklearn.feature_extraction.text import TfidfVectorizer
from hdbscan import HDBSCAN

from app.core.database import (
    get_session,
    Dataset,
    Record,
    User,
    SourceTerm,
    EntityCluster,
    ClusteredTerm,
)
from app.routes.v1.auth import get_current_user
from app.schemas import (
    DatasetResponse,
    DatasetStatsResponse,
    DatasetsOutput,
    DatasetOutput,
    RecordCreate,
    RecordResponse,
    RecordsOutput,
    RecordOutput,
    SourceTermCreate,
    SourceTermOutput,
    SourceTermsOutput,
    MessageOutput,
    PaginationParams,
    create_pagination_metadata,
)

# ================================================
# Route definitions
# ================================================

router = APIRouter()

# ================================================
# Helper functions
# ================================================


def verify_dataset_ownership(dataset: Dataset, user_id: int):
    """Verify that the user owns the dataset."""
    if dataset.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this dataset",
        )


async def parse_file(file: UploadFile) -> List[str]:
    """Parse a file into a list of records."""
    raw = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".csv"):
        import csv

        try:
            reader = csv.reader(io.StringIO(raw.decode("utf-8")))
            if reader.fieldnames is None or "text" not in reader.fieldnames:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"CSV must have a 'text' column.",
                )

            records = [
                RecordCreate(
                    patient_id=row.get("patient_id"),
                    seq_number=row.get("seq_number"),
                    text=row.get("text"),
                )
                for row in reader
                if row.get("patient_id") and row.get("text")
            ]

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse CSV: {e}",
            )

    elif filename.endswith(".json"):
        import json

        try:
            data = json.loads(raw)
            if not isinstance(data, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"JSON file must be a list of records.",
                )

            records = [
                RecordCreate(
                    patient_id=r.get("patient_id"),
                    seq_number=r.get("seq_number"),
                    text=r.get("text"),
                )
                for r in data
                if r.get("patient_id")
                and r.get("text")
                and isinstance(r.get("text"), str)
                and r.get("text").strip()
            ]

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse JSON: {e}",
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type."
        )

    return records


# ================================================
# Datasets routes
# ================================================


@router.get(
    "/",
    response_model=DatasetsOutput,
    status_code=status.HTTP_200_OK,
    summary="List all datasets",
    description="Retrieves a list of all datasets owned by the authenticated user",
    response_description="List of datasets with their metadata",
)
def get_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
    pagination: PaginationParams = Depends(),
):
    # Get total count
    total = db.exec(
        select(func.count())
        .select_from(Dataset)
        .where(Dataset.user_id == current_user.id)
    ).one()

    # Get paginated datasets
    datasets = db.exec(
        select(Dataset)
        .where(Dataset.user_id == current_user.id)
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()

    dataset_responses = [
        DatasetResponse(
            id=dataset.id,
            name=dataset.name,
            uploaded=dataset.uploaded,
            last_modified=dataset.last_modified,
            labels=dataset.labels,
            record_count=len(dataset.records),
        )
        for dataset in datasets
    ]

    return DatasetsOutput(
        datasets=dataset_responses,
        pagination=create_pagination_metadata(
            total, pagination.limit, pagination.offset
        ),
    )


@router.post(
    "/",
    response_model=DatasetOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new dataset",
    description="Creates a new dataset with its associated records",
    response_description="The created dataset with its metadata",
)
async def create_dataset(
    name: str = Form(...),
    labels: str = Form(...),  # sent as "name,age,location"
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    record_list = await parse_file(file)

    label_list = [label for label in labels.split(",")]
    dataset = Dataset(name=name, labels=label_list, user_id=current_user.id)
    db.add(dataset)
    db.commit()
    # Refresh the instance so database now has its generated ID
    db.refresh(dataset)

    for r in record_list:
        record = Record(
            patient_id=r.patient_id,
            seq_number=r.seq_number,
            text=r.text,
            dataset_id=dataset.id,
        )
        db.add(record)
    db.commit()
    db.refresh(dataset)

    dataset_response = DatasetResponse(
        id=dataset.id,
        name=dataset.name,
        uploaded=dataset.uploaded,
        last_modified=dataset.last_modified,
        labels=dataset.labels,
        record_count=len(dataset.records),
    )
    return DatasetOutput(dataset=dataset_response)


@router.get(
    "/{dataset_id}",
    response_model=DatasetOutput,
    status_code=status.HTTP_200_OK,
    summary="Get a specific dataset",
    description="Retrieves a single dataset by its ID",
    response_description="The requested dataset with its metadata",
)
def get_dataset(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)
    dataset_response = DatasetResponse(
        id=dataset.id,
        name=dataset.name,
        uploaded=dataset.uploaded,
        last_modified=dataset.last_modified,
        labels=dataset.labels,
        record_count=len(dataset.records),
    )
    return DatasetOutput(dataset=dataset_response)


@router.get(
    "/{dataset_id}/stats",
    response_model=DatasetStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get dataset statistics",
    description="Retrieves statistics for a dataset including record counts and processing status",
    response_description="Dataset statistics",
)
def get_dataset_stats(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    # Total records count
    total_records = db.exec(
        select(func.count()).select_from(Record).where(Record.dataset_id == dataset_id)
    ).one()

    # Processed count: records with at least one source term
    processed_count = db.exec(
        select(func.count(func.distinct(Record.id)))
        .select_from(Record)
        .join(SourceTerm, Record.id == SourceTerm.record_id)
        .where(Record.dataset_id == dataset_id)
    ).one()

    # Pending review count: records that have not been reviewed yet
    pending_review_count = db.exec(
        select(func.count())
        .select_from(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.reviewed == False)  # noqa: E712
    ).one()

    # Total extracted terms count
    extracted_terms_count = db.exec(
        select(func.count())
        .select_from(SourceTerm)
        .join(Record, SourceTerm.record_id == Record.id)
        .where(Record.dataset_id == dataset_id)
    ).one()

    return DatasetStatsResponse(
        total_records=total_records,
        processed_count=processed_count,
        pending_review_count=pending_review_count,
        extracted_terms_count=extracted_terms_count,
    )


@router.delete(
    "/{dataset_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Delete a dataset",
    description="Deletes a dataset and all its associated records (cascade delete)",
    response_description="Confirmation message that the dataset was deleted successfully",
)
def delete_dataset(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    db.delete(dataset)
    db.commit()
    # Cascade delete – also deletes all records linked to this dataset

    return MessageOutput(message="Dataset deleted successfully")


@router.get(
    "/{dataset_id}/download",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
    summary="Download dataset",
    description="Downloads a dataset's records as a file",
    response_description="The file containing the dataset records",
)
def download_dataset(
    dataset_id: int,
    format: str = "csv",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    # TODO: enable dataset download as JSON or CSV (?format=json or ?format=csv, where csv is the default)
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    records = dataset.records
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No records found for this dataset",
        )

    # TODO: make a separate function for this
    # FIX: the solution below does not parse the text correctly. There should be
    #      one column containing the whole text (parsed accordingly) - newlines
    #      should be properly handled (i.e. "Text text\n\ntext text" in a single line).
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["text"])
    for record in records:
        # TODO: add other fields (extracted, clusters, etc.)
        writer.writerow([record.text])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={dataset.name}.csv"},
    )


# ================================================
# Dataset records routes
# ================================================


@router.post(
    "/{dataset_id}/records",
    response_model=RecordOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Add a record to a dataset",
    description="Creates a new record and adds it to the specified dataset",
    response_description="The created record with its metadata",
)
def add_record(
    dataset_id: int,
    record: RecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    new_record = Record(
        patient_id=record.patient_id,
        seq_number=record.seq_number,
        text=record.text,
        dataset_id=dataset_id,
    )
    db.add(new_record)

    # Update dataset's last_modified timestamp
    dataset.last_modified = datetime.now(timezone.utc)

    db.commit()
    db.refresh(new_record)

    return RecordOutput(record=new_record)


@router.get(
    "/{dataset_id}/records",
    response_model=RecordsOutput,
    status_code=status.HTTP_200_OK,
    summary="List all records in a dataset",
    description="Retrieves all records belonging to a specific dataset",
    response_description="List of records in the dataset",
)
def get_records(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
    pagination: PaginationParams = Depends(),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    # Get total count
    total = db.exec(
        select(func.count()).select_from(Record).where(Record.dataset_id == dataset_id)
    ).one()

    # Get paginated records with source term counts
    records = db.exec(
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()

    # Get source term counts for these records
    record_ids = [r.id for r in records]
    term_counts = {}
    if record_ids:
        counts = db.exec(
            select(SourceTerm.record_id, func.count(SourceTerm.id))
            .where(SourceTerm.record_id.in_(record_ids))
            .group_by(SourceTerm.record_id)
        ).all()
        term_counts = {record_id: count for record_id, count in counts}

    # Build response with term counts
    records_with_counts = [
        RecordResponse(
            id=r.id,
            text=r.text,
            uploaded=r.uploaded,
            dataset_id=r.dataset_id,
            reviewed=r.reviewed,
            source_term_count=term_counts.get(r.id, 0),
        )
        for r in records
    ]

    return RecordsOutput(
        records=records_with_counts,
        pagination=create_pagination_metadata(
            total, pagination.limit, pagination.offset
        ),
    )


@router.get(
    "/{dataset_id}/records/{record_id}",
    response_model=RecordOutput,
    status_code=status.HTTP_200_OK,
    summary="Get a specific record",
    description="Retrieves a single record by its ID from a specific dataset",
    response_description="The requested record",
)
def get_record(
    dataset_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    return RecordOutput(record=record)


@router.put(
    "/{dataset_id}/records/{record_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Update a record",
    description="Updates the text content of a specific record in a dataset",
    response_description="Confirmation message that the record was updated successfully",
)
def update_record(
    dataset_id: int,
    record_id: int,
    record: RecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    db_record = db.exec(statement).one_or_none()

    if db_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    db_record.text = record.text

    # Update dataset's last_modified timestamp
    dataset.last_modified = datetime.now(timezone.utc)

    db.commit()

    return MessageOutput(message="Record updated successfully")


@router.delete(
    "/{dataset_id}/records/{record_id}",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Delete a record",
    description="Deletes a specific record from a dataset",
    response_description="Confirmation message that the record was deleted successfully",
)
def delete_record(
    dataset_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    db.delete(record)

    # Update dataset's last_modified timestamp
    dataset.last_modified = datetime.now(timezone.utc)

    db.commit()

    return MessageOutput(message="Record deleted successfully")


@router.put(
    "/{dataset_id}/records/{record_id}/review",
    response_model=MessageOutput,
    status_code=status.HTTP_200_OK,
    summary="Mark record as reviewed",
    description="Marks a specific record as reviewed or unreviewed",
    response_description="Confirmation message that the record review status was updated",
)
def review_record(
    dataset_id: int,
    record_id: int,
    reviewed: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    db_record = db.exec(statement).one_or_none()

    if db_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    db_record.reviewed = reviewed
    db.commit()

    return MessageOutput(
        message=f"Record marked as {'reviewed' if reviewed else 'not reviewed'}"
    )


# ================================================
# Source terms routes (nested under records)
# ================================================


@router.post(
    "/{dataset_id}/records/{record_id}/source-terms",
    response_model=SourceTermOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Create a source term",
    description="Creates a new source term associated with a specific record",
    response_description="The created source term",
)
def create_source_term(
    dataset_id: int,
    record_id: int,
    term: SourceTermCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    # Verify dataset ownership
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    # Verify record exists and belongs to dataset
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    source_term = SourceTerm(
        record_id=record_id,
        value=term.value,
        label=term.label,
        start_position=term.start_position,
        end_position=term.end_position,
    )
    db.add(source_term)
    db.commit()
    db.refresh(source_term)
    return SourceTermOutput(source_term=source_term)


@router.get(
    "/{dataset_id}/records/{record_id}/source-terms",
    response_model=SourceTermsOutput,
    status_code=status.HTTP_200_OK,
    summary="List all source terms for a record",
    description="Retrieves all source terms associated with a specific record",
    response_description="List of source terms in the record",
)
def get_source_terms(
    dataset_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
    pagination: PaginationParams = Depends(),
):
    # Verify dataset ownership
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    verify_dataset_ownership(dataset, current_user.id)

    # Verify record exists and belongs to dataset
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )

    # Get total count
    total = db.exec(
        select(func.count())
        .select_from(SourceTerm)
        .where(SourceTerm.record_id == record_id)
    ).one()

    # Get paginated source terms
    source_terms = db.exec(
        select(SourceTerm)
        .where(SourceTerm.record_id == record_id)
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()

    return SourceTermsOutput(
        source_terms=source_terms,
        pagination=create_pagination_metadata(
            total, pagination.limit, pagination.offset
        ),
    )


@router.get("/{dataset_id}/clusters", response_model=List[EntityCluster])
def get_entity_clusters(
    dataset_id: int,
    label: str,
    k: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Cluster SourceTerm (entities) for a single dataset.

    1. - dataset_id: which dataset to use
    - label: entity lavel we want to cluster (e.g. "Diagnosis")
    - k: requested number of clusters (will be limited if there are few terms)

    The idea:
      1) Take all SourceTerms for this dataset with the given label.
      2) Group identical texts together (same spelling).
      3) Convert each unique text into a vector (TF-IDF over character n-grams).
      4) Run KMeans to group similar texts into clusters.
      5) Return clusters with statistics that the frontend can show.
    """

    # check that dataset exists
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )
    verify_dataset_ownership(dataset, current_user.id)

    # load SourceTerms for this dataset and label
    # join with Record so we can filter by dataset_id.
    statement = (
        select(SourceTerm)
        .join(Record)
        .where(Record.dataset_id == dataset_id)
        .where(SourceTerm.label == label)
    )
    source_terms: List[SourceTerm] = db.exec(statement).all()

    if not source_terms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No source terms with this label for the dataset",
        )

    # aggregate by term text (value
    # we want to cluster unique texts, not every single occurrence.
    stats: Dict[str, Dict[str, object]] = {}

    for term in source_terms:
        # term.value is the original text of the entity
        text = (term.value or "").strip()
        if not text:
            continue

        if text not in stats:
            stats[text] = {
                "frequency": 0,  # how many SourceTerms with this value
                "record_ids": set(),  # IDs of records where this value appears
                "term_ids": [],  # IDs of SourceTerm rows with this value
            }

        stats[text]["frequency"] += 1
        stats[text]["record_ids"].add(term.record_id)
        stats[text]["term_ids"].append(term.id)

    unique_texts = list(stats.keys())
    if not unique_texts:

        return []

    # adjust number of clusters
    # i guess there is no point in having more clusters than unique texts
    k = max(1, min(k, len(unique_texts)))

    # vectorize texts (char n-grams are good for short medical terms)
    vectorizer = TfidfVectorizer(
        analyzer="char",  # work on characters, not words
        ngram_range=(3, 5),  # capture small pieces of words and endings
        min_df=1,
    )
    X = vectorizer.fit_transform(unique_texts)

    # --- 6) Run HDBSCAN clustering ---

    clusterer = HDBSCAN(
        min_cluster_size=2,  # smallest size of a meaningful cluster
        metric="euclidean",  # good with TF-IDF
        cluster_selection_method="eom",
    )

    labels_arr = clusterer.fit_predict(X.toarray())

    # You can skip noise points (-1)
    filtered_texts = []
    filtered_labels = []
    for t, cid in zip(unique_texts, labels_arr):
        if cid == -1:
            # optional: skip noise
            continue
        filtered_texts.append(t)
        filtered_labels.append(cid)

    unique_texts = filtered_texts
    labels_arr = filtered_labels

    # group texts by cluster id
    clusters_raw: Dict[int, List[str]] = defaultdict(list)
    for text, cluster_id in zip(unique_texts, labels_arr):
        clusters_raw[int(cluster_id)].append(text)

    clusters: List[EntityCluster] = []

    for cluster_id, texts_in_cluster in clusters_raw.items():
        # pick main term: the most frequent one in this cluster.
        main_text = max(texts_in_cluster, key=lambda t: stats[t]["frequency"])

        # total occurrences = sum of frequencies of all terms in this cluster.
        total_occurrences = sum(stats[t]["frequency"] for t in texts_in_cluster)

        # union of all record IDs where any of these texts appears.
        record_ids_union = set()
        for t in texts_in_cluster:
            record_ids_union.update(stats[t]["record_ids"])

        # build ClusteredTerm objects for each text in the cluster.
        term_models: List[ClusteredTerm] = []
        for t in texts_in_cluster:
            info = stats[t]
            term_models.append(
                ClusteredTerm(
                    term_id=info["term_ids"][
                        0
                    ],  # just use the first SourceTerm ID as a representative
                    text=t,
                    frequency=info["frequency"],
                    n_records=len(info["record_ids"]),
                    record_ids=sorted(info["record_ids"]),
                )
            )

        clusters.append(
            EntityCluster(
                id=cluster_id,
                main_term=main_text,
                label=label,
                total_terms=len(texts_in_cluster),
                total_occurrences=total_occurrences,
                n_records=len(record_ids_union),
                terms=term_models,
            )
        )

    # sort clusters by how "big" they are (most frequent first)
    clusters.sort(key=lambda c: c.total_occurrences, reverse=True)

    return clusters

@router.post("/{dataset_id}/clusters/rebuild", response_model=MessageOutput)
def rebuild_clusters(
    dataset_id: int,
    label: str,
    db: Session = Depends(get_db)
):


    # --- 1. Check dataset exists ---
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found"
        )

    # --- 2. Load SourceTerms belonging to this dataset & label ---
    source_terms = db.exec(
        select(SourceTerm)
        .join(Record)
        .where(Record.dataset_id == dataset_id)
        .where(SourceTerm.label == label)
    ).all()

    if not source_terms:
        raise HTTPException(
            status_code=400,
            detail="No source terms for this label in dataset"
        )

    # --- 3. Prepare texts ---
    texts = [st.value for st in source_terms]
    if len(texts) == 0:
        return MessageOutput(message="No terms to cluster")

    # --- 4. TF-IDF vectorization ---
    vectorizer = TfidfVectorizer(
        analyzer="char",
        ngram_range=(3, 5)
    )
    X = vectorizer.fit_transform(texts)

    # --- 5. Run HDBSCAN ---
    clusterer = HDBSCAN(
        min_cluster_size=2,
        metric="euclidean",
        cluster_selection_method="eom"
    )

    labels_arr = clusterer.fit_predict(X.toarray())

    # --- 6. Remove existing clusters for this dataset/label ---
    old_clusters = db.exec(
        select(Cluster)
        .where(Cluster.dataset_id == dataset_id)
        .where(Cluster.label == label)
    ).all()

    for c in old_clusters:
        db.delete(c)
    db.commit()

    # --- 7. Create new clusters ---
    cluster_map = {}  # cluster_id (from HDBSCAN) -> Cluster DB object

    for st, cid in zip(source_terms, labels_arr):

        if cid == -1:
            # HDBSCAN noise → create a one-term cluster
            new_cluster = Cluster(
                dataset_id=dataset_id,
                label=label,
                title=st.value  # title = first term
            )
            db.add(new_cluster)
            db.commit()
            db.refresh(new_cluster)

            st.cluster_id = new_cluster.id
            db.add(st)
            continue

        # If the cluster is seen for the first time
        if cid not in cluster_map:
            new_cluster = Cluster(
                dataset_id=dataset_id,
                label=label,
                title=st.value  # first term becomes cluster title
            )
            db.add(new_cluster)
            db.commit()
            db.refresh(new_cluster)

            cluster_map[cid] = new_cluster

        # Assign term to cluster
        st.cluster_id = cluster_map[cid].id
        db.add(st)

    db.commit()

    return MessageOutput(message="Clusters rebuilt and saved to database.")

@router.post("/source-terms/{term_id}/auto-assign", response_model=MessageOutput)
def auto_assign_source_term(
    term_id: int,
    db: Session = Depends(get_db),
):
    # --- 1. Load term ---
    term = db.get(SourceTerm, term_id)
    if not term:
        raise HTTPException(404, "SourceTerm not found")

    # Need record.dataset_id
    record = db.get(Record, term.record_id)
    if not record:
        raise HTTPException(404, "Record not found")

    dataset_id = record.dataset_id

    # --- 2. Load all clusters for this dataset + label ---
    clusters = db.exec(
        select(Cluster)
        .where(Cluster.dataset_id == dataset_id)
        .where(Cluster.label == term.label)
    ).all()

    if not clusters:
        # No clusters yet → create new
        new_cluster = Cluster(
            dataset_id=dataset_id,
            label=term.label,
            title=term.value,
        )
        db.add(new_cluster)
        db.commit()
        db.refresh(new_cluster)

        term.cluster_id = new_cluster.id
        db.add(term)
        db.commit()

        return MessageOutput(
            message=f"Created new cluster {new_cluster.id} (no existing clusters)."
        )

    # --- 3. Build TF-IDF vectors for comparing term with clusters ---
    # Collect representatives: cluster.title is our reference term
    cluster_titles = [c.title for c in clusters]
    items_for_vectorizer = cluster_titles + [term.value]

    vectorizer = TfidfVectorizer(
        analyzer="char",
        ngram_range=(3, 5)
    )
    X = vectorizer.fit_transform(items_for_vectorizer)

    # Last vector = term
    term_vec = X[-1]

    # All others = cluster titles
    cluster_vecs = X[:-1]

    # --- 4. Compute cosine similarity ---
    from sklearn.metrics.pairwise import cosine_similarity

    sims = cosine_similarity(term_vec, cluster_vecs)[0]

    best_idx = sims.argmax()
    best_sim = sims[best_idx]
    best_cluster = clusters[best_idx]

    # --- 5. Threshold decision ---
    SIM_THRESHOLD = 0.35  # Can tune later

    if best_sim >= SIM_THRESHOLD:
        # Assign to existing cluster
        term.cluster_id = best_cluster.id
        db.add(term)
        db.commit()

        return MessageOutput(
            message=f"Assigned to existing cluster {best_cluster.id} (sim={best_sim:.2f})"
        )

    else:
        # --- 6. Create a new cluster ---
        new_cluster = Cluster(
            dataset_id=dataset_id,
            label=term.label,
            title=term.value
        )
        db.add(new_cluster)
        db.commit()
        db.refresh(new_cluster)

        term.cluster_id = new_cluster.id
        db.add(term)
        db.commit()

        return MessageOutput(
            message=f"Created new cluster {new_cluster.id} (sim={best_sim:.2f})"
        )
    
@router.get("/{dataset_id}/clusters/db")
def get_clusters_from_db(
    dataset_id: int,
    label: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns all persistent clusters for a dataset.
    If label is provided, filters by entity label
    """

    query = select(Cluster).where(Cluster.dataset_id == dataset_id)

    if label:
        query = query.where(Cluster.label == label)

    clusters = db.exec(query).all()

    return clusters

@router.get("/clusters/{cluster_id}")
def get_cluster(cluster_id: int, db: Session = Depends(get_db)):
    """
    Returns details of a single cluster, including its source terms.
    """

    cluster = db.get(Cluster, cluster_id)
    if not cluster:
        raise HTTPException(404, "Cluster not found")

    return cluster

@router.put("/clusters/{cluster_id}")
def rename_cluster(
    cluster_id: int,
    title: str,
    db: Session = Depends(get_db),
):
    """
    Rename a cluster (title).
    """

    cluster = db.get(Cluster, cluster_id)
    if not cluster:
        raise HTTPException(404, "Cluster not found")

    cluster.title = title
    db.add(cluster)
    db.commit()

    return {"message": "Cluster renamed", "new_title": title}

@router.delete("/clusters/{cluster_id}")
def delete_cluster(
    cluster_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a cluster.
    All SourceTerms in this cluster get cluster_id = NULL.
    """

    cluster = db.get(Cluster, cluster_id)
    if not cluster:
        raise HTTPException(404, "Cluster not found")

    # Remove cluster assignment from terms
    for term in cluster.source_terms:
        term.cluster_id = None
        db.add(term)

    db.delete(cluster)
    db.commit()

    return {"message": "Cluster deleted"}

@router.post("/source-terms/{term_id}/assign/{cluster_id}")
def assign_term_to_cluster(
    term_id: int,
    cluster_id: int,
    db: Session = Depends(get_db),
):
    """
    Manually assign a SourceTerm to a cluster.
    """

    term = db.get(SourceTerm, term_id)
    cluster = db.get(Cluster, cluster_id)

    if not term:
        raise HTTPException(404, "SourceTerm not found")
    if not cluster:
        raise HTTPException(404, "Cluster not found")

    term.cluster_id = cluster.id
    db.add(term)
    db.commit()

    return {"message": f"SourceTerm {term_id} assigned to cluster {cluster_id}"}

@router.post("/source-terms/{term_id}/unassign")
def unassign_term_from_cluster(
    term_id: int,
    db: Session = Depends(get_db),
):
    """
    Remove SourceTerm from its cluster (cluster_id = NULL).
    """

    term = db.get(SourceTerm, term_id)
    if not term:
        raise HTTPException(404, "SourceTerm not found")

    term.cluster_id = None
    db.add(term)
    db.commit()

    return {"message": f"SourceTerm {term_id} unassigned from cluster"}




