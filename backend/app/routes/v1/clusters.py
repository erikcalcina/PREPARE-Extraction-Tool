from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from typing import List, Optional
from datetime import datetime, timezone

from sqlmodel import select
from app.models_db import ClusterMergeSuggestion, SourceTerm
from app.schemas import MergeSuggestionsOutput, MergeSuggestionResponse, ClusterShort

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

@router.get("/datasets/{dataset_id}/clusters/merge-suggestions", response_model=MergeSuggestionsOutput)

def list_merge_suggestions(
    dataset_id: int,
    label: str,
    status_filter: str = "pending",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    List merge suggestions for a dataset and label.
    Default: only pending suggestions.
    """
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    verify_dataset_ownership(dataset, current_user.id)

    suggestions = db.exec(
        select(ClusterMergeSuggestion)
        .where(ClusterMergeSuggestion.dataset_id == dataset_id)
        .where(ClusterMergeSuggestion.label == label)
        .where(ClusterMergeSuggestion.status == status_filter)
        .order_by(ClusterMergeSuggestion.score.desc())
    ).all()

    result: List[MergeSuggestionResponse] = []
    for s in suggestions:
        a = db.get(Cluster, s.cluster_a_id)
        b = db.get(Cluster, s.cluster_b_id)
        if not a or not b:
            continue

        result.append(
            MergeSuggestionResponse(
                id=s.id,
                dataset_id=s.dataset_id,
                label=s.label,
                method=s.method,
                score=s.score,
                status=s.status,
                created_at=s.created_at,
                cluster_a=ClusterShort(
                    id=a.id,
                    title=a.title,
                    label=a.label,
                    dataset_id=a.dataset_id,
                ),
                cluster_b=ClusterShort(
                    id=b.id,
                    title=b.title,
                    label=b.label,
                    dataset_id=b.dataset_id,
                ),
            )
        )

    return MergeSuggestionsOutput(suggestions=result)


@router.post("/datasets/{dataset_id}/clusters/merge-suggestions/{suggestion_id}/reject", response_model=MessageOutput)
def reject_merge_suggestion(
    dataset_id: int,
    suggestion_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    suggestion = db.get(ClusterMergeSuggestion, suggestion_id)
    if not suggestion or suggestion.dataset_id != dataset_id:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    dataset = db.get(Dataset, dataset_id)
    verify_dataset_ownership(dataset, current_user.id)

    suggestion.status = "rejected"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by_user_id = current_user.id

    db.add(suggestion)
    db.commit()

    return MessageOutput(message="Suggestion rejected")

@router.post("/datasets/{dataset_id}/clusters/merge-suggestions/{suggestion_id}/accept", response_model=MessageOutput)
def accept_merge_suggestion(
    dataset_id: int,
    suggestion_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    suggestion = db.get(ClusterMergeSuggestion, suggestion_id)
    if not suggestion or suggestion.dataset_id != dataset_id:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    dataset = db.get(Dataset, dataset_id)
    verify_dataset_ownership(dataset, current_user.id)

    cluster_a = db.get(Cluster, suggestion.cluster_a_id)
    cluster_b = db.get(Cluster, suggestion.cluster_b_id)
    if not cluster_a or not cluster_b:
        raise HTTPException(status_code=404, detail="Cluster not found")

    # 1) Move all terms from B to A
    terms_b = db.exec(select(SourceTerm).where(SourceTerm.cluster_id == cluster_b.id)).all()
    for t in terms_b:
        t.cluster_id = cluster_a.id
        db.add(t)

    # 2) Delete cluster B
    db.delete(cluster_b)

    # 3) Mark suggestion accepted
    suggestion.status = "accepted"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by_user_id = current_user.id
    db.add(suggestion)

    db.commit()

    return MessageOutput(message="Clusters merged (accepted suggestion)")


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

    #remove cluster assignment from terms
    for term in cluster.source_terms:
        term.cluster_id = None
        db.add(term)

    db.delete(cluster)
    db.commit()

    return MessageOutput(message="Cluster deleted")



