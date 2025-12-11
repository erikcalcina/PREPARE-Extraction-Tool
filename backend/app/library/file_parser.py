from collections import defaultdict
from datetime import datetime, timezone
from dateutil import parser
from typing import List, Dict
import csv
import io
import json

from fastapi import HTTPException, status, UploadFile

from app.models_db import Record, Concept


# ================================================
# Functions to parse uploaded files
# ================================================


async def parse_records_file(file: UploadFile, required_columns: list) -> List[Record]:
    """Parse a file into a list of records."""
    raw = await file.read()
    filename = file.filename.lower()
    text = raw.decode("utf-8")

    if filename.endswith(".csv"):
        return parse_csv(text, required_columns)
        
    elif filename.endswith(".json"):
        return parse_json(text, required_columns)

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type."
        )

def parse_csv(text, required_columns) -> List[Record]:
    """Parse a CSV file into a list of records."""

    try:
        reader = csv.DictReader(io.StringIO(text))
        csv_columns = reader.fieldnames

        if csv_columns is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file is empty or invalid.",
            )
        
        # Validate that all required fields exist
        missing = [col for col in required_columns if col not in csv_columns]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {', '.join(missing)}",
            )

        records = []
        for row in reader:
            if not row.get("text"):
                continue
            
            date_str = row.get("date")
            if date_str:
                try:
                    date_obj = parser.parse(date_str)
                except (ValueError, TypeError):
                    date_obj = None
            else:
                date_obj = None

            records.append(
                Record(
                patient_id=row["patient_id"],
                seq_number=row.get("seq_number"),
                date=date_obj,
                text=row["text"]
                )
            ) 

        return records
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {e}",
        )
    
def parse_json(text, required_columns) -> List[Record]:
    """Parse a JSON file into a list of records."""

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
        
        records = []
        for obj in items:
            # Validate that all required fields exist
            missing = [col for col in required_columns if col not in items[0]]

            if missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required columns: {', '.join(missing)}",
                )
            
            date_str = obj.get("date")
            if date_str:
                try:
                    date_obj = parser.parse(date_str)
                except (ValueError, TypeError):
                    date_obj = None
            else:
                date_obj = None

            records.append(
                Record(
                patient_id=obj["patient_id"],
                seq_number=obj.get("seq_number"),
                date=date_obj,
                text=obj["text"]
                )
            ) 

        return records

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse JSON: {e}",
        )
    

async def parse_concepts_file(file: UploadFile, required_columns: list) -> List[Concept]:
    """Parse a CSV file into a list of concepts."""

    raw = await file.read()
    filename = file.filename.lower()
    text = raw.decode("utf-8")

    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type."
        )

    try:
        reader = csv.DictReader(io.StringIO(text), delimiter="\t")
        csv_columns = reader.fieldnames

        if csv_columns is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file is empty or invalid.",
            )
        
        missing = [col for col in required_columns if col not in csv_columns]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {', '.join(missing)}",
            )

        concepts = []
        for row in reader:
            value = row.get("concept_name")
            if not value or not value.strip():
                continue

            concepts.append(
                Concept(
                    vocab_term_id=row["concept_id"],
                    vocab_term_name=value,
                    domain_id=row["domain_id"],
                    concept_class_id=row["concept_class_id"],
                    standard_concept=row.get("standard_concept"),
                    concept_code=row.get("concept_code"),
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
    

# ================================================
# Functions to download files
# ================================================

def download_anotated_dataset(records, format): 
    if format == "csv":

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["patient_id", "seq_number", "date", "entity_type", "entity_name"])
        for record in records:
            writer.writerow([record.patient_id, record.seq_number, record.date, ])
        output.seek(0)

    elif format == "json":
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsuported file format: {format}",
        )