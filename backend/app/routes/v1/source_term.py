from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.model_registry import model_registry
from app.core.database import (
    get_session,
    User,
    Dataset,
    SourceTerm,
    Cluster,
)
from app.routes.v1.auth import get_current_user
from app.schemas import (
    MessageOutput,
    SourceTermOutput,
    BatchTermToClusterMapping,
)

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


# ================================================
# Route definitions
# ================================================

router = APIRouter()


@router.post("/{term_id}/auto-map-to-cluster", response_model=MessageOutput)
def auto_map_source_term_to_cluster(
    term_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    # --- 1. Load term ---
    source_term = db.get(SourceTerm, term_id)
    if not source_term:
        raise HTTPException(404, "SourceTerm not found")

    verify_dataset_ownership(source_term.record.dataset, current_user.id)

    dataset_id = source_term.record.dataset_id

    # --- 2. Load all clusters for this dataset + label ---
    clusters = db.exec(
        select(Cluster)
        .where(Cluster.dataset_id == dataset_id)
        .where(Cluster.label == source_term.label)
    ).all()

    if not clusters:
        # No clusters yet → create new
        new_cluster = Cluster(
            dataset_id=dataset_id,
            label=source_term.label,
            title=source_term.value,
        )
        db.add(new_cluster)
        db.commit()
        db.refresh(new_cluster)

        source_term.cluster_id = new_cluster.id
        db.add(source_term)
        db.commit()

        return MessageOutput(
            message=f"Created new cluster {new_cluster.id} (no existing clusters)."
        )

    # --- 3. Use embedding model instead of TF-IDF ---
    embedding_model = model_registry.get_model("embedding")

    # Cluster representatives = cluster titles
    cluster_titles = [c.title for c in clusters]

    # Get embeddings
    cluster_vectors = embedding_model.embed(cluster_titles)
    source_term_vector = embedding_model.embed([source_term.value])[0]

    # --- 4. Compute cosine similarity ---
    from sklearn.metrics.pairwise import cosine_similarity

    sims = cosine_similarity([source_term_vector], cluster_vectors)[0]

    best_idx = sims.argmax()
    best_sim = sims[best_idx]
    best_cluster = clusters[best_idx]

    # --- 5. Threshold decision ---
    SIM_THRESHOLD = 0.35  # Can tune later

    if best_sim >= SIM_THRESHOLD:
        # Assign to existing cluster
        source_term.cluster_id = best_cluster.id
        db.add(source_term)
        db.commit()

        return MessageOutput(
            message=f"Assigned to existing cluster {best_cluster.id} (sim={best_sim:.2f})"
        )

    else:
        # --- 6. Create a new cluster ---
        new_cluster = Cluster(
            dataset_id=dataset_id, label=source_term.label, title=source_term.value
        )
        db.add(new_cluster)
        db.commit()
        db.refresh(new_cluster)

        source_term.cluster_id = new_cluster.id
        db.add(source_term)
        db.commit()

        return MessageOutput(
            message=f"Created new cluster {new_cluster.id} (sim={best_sim:.2f})"
        )


@router.post("/batch-map-clusters", response_model=MessageOutput)
def batch_map_source_terms_to_clusters(
    input: BatchTermToClusterMapping,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Bulk mapping of source terms to clusters.
    """
    if not input.mappings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No mappings provided"
        )

    updated_count = 0
    for mapping in input.mappings:
        source_term_id = mapping.term_id
        cluster_id = mapping.cluster_id

        source_term = db.get(SourceTerm, source_term_id)
        if not source_term:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source term {source_term_id} not found",
            )
        # Verify ownership through term -> record -> dataset -> user
        verify_dataset_ownership(source_term.record.dataset, current_user.id)

        cluster = db.get(Cluster, cluster_id)
        if not cluster:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cluster {cluster_id} not found",
            )
        # Verify ownership through cluster -> dataset -> user
        verify_dataset_ownership(cluster.dataset, current_user.id)

        source_term.cluster_id = cluster.id

        db.add(source_term)
        updated_count += 1

    db.commit()

    return MessageOutput(message=f"Successfully mapped {updated_count} terms")


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

    # Verify ownership through source term -> record -> dataset -> user
    verify_dataset_ownership(source_term.record.dataset, current_user.id)

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

    # Verify ownership through source term -> record -> dataset -> user
    verify_dataset_ownership(source_term.record.dataset, current_user.id)

    db.delete(source_term)
    db.commit()

    return MessageOutput(message="Source term deleted successfully")


# ================================================
# Source term to cluster assignment routes
# ================================================


@router.post("/{term_id}/map-cluster/{cluster_id}", response_model=MessageOutput)
def map_source_term_to_cluster(
    term_id: int,
    cluster_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Manually assign a SourceTerm to a cluster.
    """

    source_term = db.get(SourceTerm, term_id)
    cluster = db.get(Cluster, cluster_id)

    if not source_term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source term {term_id} not found",
        )
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cluster {cluster_id} not found",
        )

    # Verify ownership through source term -> record -> dataset -> user
    verify_dataset_ownership(source_term.record.dataset, current_user.id)
    # Verify ownership through cluster -> dataset -> user
    verify_dataset_ownership(cluster.dataset, current_user.id)

    source_term.cluster_id = cluster.id
    db.add(source_term)
    db.commit()

    return MessageOutput(
        message=f"Source term {term_id} mapped to cluster {cluster_id}"
    )


@router.post("/{term_id}/unmap-cluster", response_model=MessageOutput)
def unmap_source_term_from_cluster(
    term_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Remove source term from its cluster.
    """

    source_term = db.get(SourceTerm, term_id)
    if not source_term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source term not found"
        )

    # Verify ownership through source term -> record -> dataset -> user
    verify_dataset_ownership(source_term.record.dataset, current_user.id)

    source_term.cluster_id = None
    db.add(source_term)
    db.commit()

    return MessageOutput(message=f"Source term {term_id} unmapped from cluster")
