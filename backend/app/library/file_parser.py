import io
import csv
import codecs
import json
from typing import List

from dateutil import parser
from datetime import datetime
import ijson

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

async def parse_json(
    file: UploadFile,
    required_columns: list,
):
    """Streaming JSON parser – yields Record objects one by one."""

    if not file.filename.lower().endswith(".json"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type.",
        )
    
    items = ijson.items(file.file, "item")

    for i, obj in enumerate(items):
        if not isinstance(obj, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="JSON array must contain objects.",
            )

        missing = [col for col in required_columns if col not in obj]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns at index {i}: {', '.join(missing)}",
            )

        date_str = obj.get("date")
        if date_str:
            try:
                date_obj = parser.parse(date_str)
            except (ValueError, TypeError):
                date_obj = None
        else:
            date_obj = None

        yield Record(
            patient_id=obj["patient_id"],
            seq_number=obj.get("seq_number"),
            date=date_obj,
            text=obj["text"],
        )

async def parse_csv(
    file: UploadFile,
    required_columns: list,
):
    """Streaming parser – yields Record objects one by one."""

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type.",
        )

    text_stream = codecs.getreader("utf-8")(file.file)

    reader = csv.DictReader(text_stream)

    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty or invalid.",
        )

    missing = [col for col in required_columns if col not in reader.fieldnames]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing)}",
        )

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

        yield Record(
            patient_id=row["patient_id"],
            seq_number=row.get("seq_number"),
            date=date_obj,
            text=row["text"],
        )


async def parse_concepts_file(
    file: UploadFile, required_columns: list
):
    """Streaming parser – yields Concept objects one by one."""

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type.",
        )

    text_stream = codecs.getreader("utf-8")(file.file)
    reader = csv.DictReader(text_stream, delimiter="\t")

    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty or invalid.",
        )

    missing = [c for c in required_columns if c not in reader.fieldnames]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing)}",
        )

    for row in reader:
        value = row.get("concept_name")
        if not value or not value.strip():
            continue

        yield Concept(
            vocab_term_id=row["concept_id"],
            vocab_term_name=value.strip(),
            domain_id=row["domain_id"],
            concept_class_id=row["concept_class_id"],
            standard_concept=row.get("standard_concept"),
            concept_code=row.get("concept_code"),
            valid_start_date=datetime.strptime(
                row["valid_start_date"], "%Y%m%d"
            ),
            valid_end_date=datetime.strptime(
                row["valid_end_date"], "%Y%m%d"
            ),
            invalid_reason=row.get("invalid_reason"),
        )


# ================================================
# Functions to download files
# ================================================


def download_annotated_dataset(records, format):
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(
            ["patient_id", "seq_number", "date", "entity_type", "entity_name"]
        )
        for record in records:
            for term in record.source_terms:
                entity_type = term.label
                entity_name = term.cluster.title
                writer.writerow(
                    [
                        record.patient_id,
                        record.seq_number,
                        record.date,
                        entity_type,
                        entity_name,
                    ]
                )
        output.seek(0)
        return output.getvalue(), "text/csv"

    elif format == "json":
        data = []
        for record in records:
            for term in record.source_terms:
                entity_type = term.label
                entity_name = term.cluster.title
                data.append(
                    {
                        "patient_id": record.patient_id,
                        "seq_number": record.seq_number,
                        "date": record.date.isoformat() if record.date else None,
                        "entity_type": entity_type,
                        "entity_name": entity_name,
                    }
                )
        return json.dumps(data), "application/json"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsuported file format: {format}",
        )
