import csv
import io
from collections import defaultdict
from datetime import datetime, timezone

from typing import List, Dict

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func

from app.models_db import Record, Concept

async def parse_records_file(file: UploadFile, REQUIRED_COLUMNS: list) -> List[Record]:
    """Parse a file into a list of records."""
    raw = await file.read()
    filename = file.filename.lower()
    text = raw.decode("utf-8")

    if filename.endswith(".csv"):
        return parse_csv(text, REQUIRED_COLUMNS)
        
    elif filename.endswith(".json"):
        return parse_json(text, REQUIRED_COLUMNS)

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type."
        )

def parse_csv(text, REQUIRED_COLUMNS) -> List[Record]:
    import csv

    try:
        reader = csv.DictReader(io.StringIO(text))
        csv_columns = reader.fieldnames

        if csv_columns is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file is empty or invalid.",
            )
        
        # Validate that all required fields exist
        missing = [col for col in REQUIRED_COLUMNS if col not in csv_columns]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {", ".join(missing)}",
            )

        records = []
        for row in reader:
            if not row.get("text"):
                continue

            records.append(
                Record(
                patient_id=row.get("patient_id"),
                seq_number=row.get("seq_number"),
                text=row.get("text")
                )
            ) 

        return records
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {e}",
        )
    
def parse_json(text, REQUIRED_COLUMNS) -> List[Record]:
    import json

    try:
        items = json.loads(text)

        if not isinstance(items, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"JSON file must contain an array of objects.",
            )

        if not items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="JSON is empty."
            )
        
        # Validate that all required fields exist
        missing = [col for col in REQUIRED_COLUMNS if col not in items[0]]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {", ".join(missing)}",
            )
        
        records = []
        for obj in items:
            if not obj.get("text"):
                continue

            records.append(
                Record(
                patient_id=obj.get("patient_id"),
                seq_number=obj.get("seq_number"),
                text=obj.get("text")
                )
            ) 

        return records

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse JSON: {e}",
        )
    

async def parse_concepts_file(file: UploadFile, REQUIRED_COLUMNS: list) -> List[Record]:
    import csv

    raw = await file.read()
    filename = file.filename.lower()
    text = raw.decode("utf-8")

    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type."
        )

    try:
        reader = csv.DictReader(io.StringIO(text))
        csv_columns = reader.fieldnames

        if csv_columns is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file is empty or invalid.",
            )
        
        missing = [col for col in REQUIRED_COLUMNS if col not in csv_columns]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {", ".join(missing)}",
            )

        concepts = []
        for row in reader:
            if not row.get("concept_id"):
                continue

            concepts.append(
                Concept(
                    vocab_term_id=row["concept_id"],
                    vocab_term_name=row["concept_name"],
                    domain_id=row["domain_id"],
                    concept_class_id=row["concept_class_id"],
                    standard_concept=row["standard_concept"],
                    concept_code=row["concept_code"],
                    valid_start_date=datetime.strptime(row["valid_start_date"], "%Y%m%d"),
                    valid_end_date=datetime.strptime(row["valid_end_date"], "%Y%m%d"),
                    invalid_reason=row.get("invalid_reason")
                )
            ) 

        return concepts
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {e}",
        )