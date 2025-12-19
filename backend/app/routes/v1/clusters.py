from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.database import get_session
from app.models_db import Dataset, User, Cluster
from app.routes.v1.auth import get_current_user
from app.schemas import (
    MessageOutput,
    ClusterOutput,
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


# ================================================
# Clusters routes
# ================================================


@router.get("/{cluster_id}", response_model=ClusterOutput)
def get_cluster(
    cluster_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Returns details of a single cluster, including its source terms"""

    cluster = db.get(Cluster, cluster_id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found"
        )

    verify_dataset_ownership(cluster.dataset, current_user.id)

    return ClusterOutput(cluster=cluster)


@router.put("/{cluster_id}", response_model=MessageOutput)
def rename_cluster(
    cluster_id: int,
    title: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Rename a cluster (title)"""

    cluster = db.get(Cluster, cluster_id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found"
        )

    verify_dataset_ownership(cluster.dataset, current_user.id)

    cluster.title = title
    db.add(cluster)
    db.commit()

    return MessageOutput(message=f"Cluster renamed to {title}")


@router.delete("/{cluster_id}", response_model=MessageOutput)
def delete_cluster(
    cluster_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Delete a cluster.
    All SourceTerms in this cluster get cluster_id = NULL.
    """

    cluster = db.get(Cluster, cluster_id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cluster not found"
        )

    verify_dataset_ownership(cluster.dataset, current_user.id)

    # Remove cluster assignment from terms
    for term in cluster.source_terms:
        term.cluster_id = None
        db.add(term)

    db.delete(cluster)
    db.commit()

    return MessageOutput(message="Cluster deleted")
