import csv
import io
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.core.database import get_db
from app.models import DatasetCreate, MessageOutput, RecordCreate
from app.models_db import Dataset, Record

from collections import defaultdict
from typing import List, Dict

from sklearn.feature_extraction.text import TfidfVectorizer
from hdbscan import HDBSCAN

from app.core.database import get_db
from app.models import DatasetCreate, MessageOutput, RecordCreate, EntityCluster, ClusteredTerm
from app.models_db import Dataset, Record, SourceTerm



router = APIRouter(tags=["Datasets"])


# DATASETS

@router.post("/", response_model=MessageOutput, status_code=status.HTTP_201_CREATED)
def create_dataset(dataset: DatasetCreate, db: Session = Depends(get_db)):
    db_dataset = Dataset(
        name=dataset.name,
        labels=dataset.labels
    )
    db.add(db_dataset)
    db.commit()
    # Refresh the instance so db_dataset now has its generated ID
    db.refresh(db_dataset)

    for r in dataset.records:
        db_record = Record(
            text=r.text,
            dataset_id=db_dataset.id
        )
        db.add(db_record)
    db.commit()

    return MessageOutput(message="Dataset created")

@router.get("/", response_model=List[Dataset])
def get_datasets(db: Session = Depends(get_db)):
    datasets = db.exec(select(Dataset)).all()  
    return datasets

@router.get("/{dataset_id}", response_model=Dataset)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    return dataset

@router.delete("/{dataset_id}", response_model=MessageOutput)
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    
    db.delete(dataset)
    db.commit()
    # Cascade delete – also deletes all records linked to this dataset

    return MessageOutput(message="Dataset deleted")

@router.get("/{dataset_id}/download", response_class=StreamingResponse)
def download_dataset_csv(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    records = dataset.records
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No records found for this dataset")

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["text"])
    for record in records:
        writer.writerow([record.text])
    # TODO: add other fields (extracted, clusters, etc.)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={dataset.name}.csv"}
    )


# RECORDS

@router.post("/{dataset_id}/records", response_model=MessageOutput, status_code=status.HTTP_201_CREATED)
def add_record(dataset_id: int, record: RecordCreate, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    
    record_db = Record(
        text=record.text,
        dataset_id=dataset_id
    )
    db.add(record_db)
    db.commit()
    db.refresh(record_db)

    return MessageOutput(message="Record added")

@router.get("/{dataset_id}/records", response_model=List[Record])
def get_records(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    
    return dataset.records

@router.get("/{dataset_id}/records/{record_id}", response_model=Record)
def get_record(dataset_id: int, record_id: int, db: Session = Depends(get_db)):
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")   
    
    return record

@router.delete("/{dataset_id}/records/{record_id}", response_model=MessageOutput)
def delete_record(dataset_id: int, record_id: int, db: Session = Depends(get_db)):
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    record = db.exec(statement).one_or_none()

    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    
    db.delete(record)
    db.commit()

    return MessageOutput(message="Record deleted")

@router.put("/{dataset_id}/records/{record_id}", response_model=MessageOutput)
def update_record(dataset_id: int, record_id: int, record: RecordCreate, db: Session = Depends(get_db)):
    statement = (
        select(Record)
        .where(Record.dataset_id == dataset_id)
        .where(Record.id == record_id)
    )
    db_record = db.exec(statement).one_or_none()

    if db_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")   
    
    db_record.text = record.text
    db.commit()

    return MessageOutput(message="Record updated")

@router.get("/{dataset_id}/clusters", response_model=List[EntityCluster])
def get_entity_clusters(
    dataset_id: int,
    label: str,
    k: int = 10,
    db: Session = Depends(get_db),
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

    #check that dataset exists
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )

    #load SourceTerms for this dataset and label
    #join with Record so we can filter by dataset_id.
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

    #aggregate by term text (value
    #we want to cluster unique texts, not every single occurrence.
    stats: Dict[str, Dict[str, object]] = {}

    for term in source_terms:
        #term.value is the original text of the entity
        text = (term.value or "").strip()
        if not text:
            continue

        if text not in stats:
            stats[text] = {
                "frequency": 0,         # how many SourceTerms with this value
                "record_ids": set(),    # IDs of records where this value appears
                "term_ids": [],         # IDs of SourceTerm rows with this value
            }

        stats[text]["frequency"] += 1
        stats[text]["record_ids"].add(term.record_id)
        stats[text]["term_ids"].append(term.id)

    unique_texts = list(stats.keys())
    if not unique_texts:
       
        return []

    #adjust number of clusters
    #i guess there is no point in having more clusters than unique texts
    k = max(1, min(k, len(unique_texts)))

    #vectorize texts (char n-grams are good for short medical terms) 
    vectorizer = TfidfVectorizer(
        analyzer="char",       # work on characters, not words
        ngram_range=(3, 5),    # capture small pieces of words and endings
        min_df=1,
    )
    X = vectorizer.fit_transform(unique_texts)

        # --- 6) Run HDBSCAN clustering ---
    

    clusterer = HDBSCAN(
        min_cluster_size=2,           # smallest size of a meaningful cluster
        metric='euclidean',           # good with TF-IDF
        cluster_selection_method='eom'
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


    

    #group texts by cluster id
    clusters_raw: Dict[int, List[str]] = defaultdict(list)
    for text, cluster_id in zip(unique_texts, labels_arr):
        clusters_raw[int(cluster_id)].append(text)

    clusters: List[EntityCluster] = []

    for cluster_id, texts_in_cluster in clusters_raw.items():
        #pick main term: the most frequent one in this cluster.
        main_text = max(texts_in_cluster, key=lambda t: stats[t]["frequency"])

        #total occurrences = sum of frequencies of all terms in this cluster.
        total_occurrences = sum(stats[t]["frequency"] for t in texts_in_cluster)

        #union of all record IDs where any of these texts appears.
        record_ids_union = set()
        for t in texts_in_cluster:
            record_ids_union.update(stats[t]["record_ids"])

        #build ClusteredTerm objects for each text in the cluster.
        term_models: List[ClusteredTerm] = []
        for t in texts_in_cluster:
            info = stats[t]
            term_models.append(
                ClusteredTerm(
                    term_id=info["term_ids"][0],           # just use the first SourceTerm ID as a representative
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

    #sort clusters by how "big" they are (most frequent first)
    clusters.sort(key=lambda c: c.total_occurrences, reverse=True)

    return clusters
