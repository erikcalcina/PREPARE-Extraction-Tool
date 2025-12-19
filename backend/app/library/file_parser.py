import io
import csv
import json

from dateutil import parser
from datetime import datetime

from typing import List

from fastapi import HTTPException, status, UploadFile

from app.models_db import Record, Concept


# ================================================
# Functions to parse uploaded files
# ================================================


async def parse_records_file(file: UploadFile, required_columns: list) -> List[Record]:
    """Parse a file into a list of records."""
    filename = file.filename.lower()

    if filename.endswith(".csv"):
        return parse_csv_stream(file, required_columns)

    elif filename.endswith(".json"):
        raw = await file.read()
        text = raw.decode("utf-8")
        return parse_json(text, required_columns)

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type.",
        )


def parse_csv_stream(
    file: UploadFile,
    required_columns: List[str],
) -> List[Record]:
    """
    Parse CSV file using streaming (line-by-line).

    This function DOESNT read the whole file into memory,
    which makes it easier ans safe for large CSV uploads.
    """

    try:
        # Wrap raw file stream into text mode
        text_stream = io.TextIOWrapper(file.file, encoding="utf-8")
        reader = csv.DictReader(text_stream)

        if reader.fieldnames is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file is empty or invalid.",
            )

        # Validate required columns
        missing = [c for c in required_columns if c not in reader.fieldnames]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {', '.join(missing)}",
            )

        records: List[Record] = []

        for row in reader:
            if not row.get("text"):
                continue

            # Psrse optional date field
            date_obj = None
            if row.get("date"):
                try:
                    date_obj = parser.parse(row["date"])
                except Exception:
                    pass

            records.append(
                Record(
                    patient_id=row["patient_id"],
                    seq_number=row.get("seq_number"),
                    date=date_obj,
                    text=row["text"],
                )
            )

        return records

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV file: {exc}",
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
                status_code=status.HTTP_400_BAD_REQUEST, detail="JSON is empty."
            )

        records = []
        for i, obj in enumerate(items):
            # Validate that all required fields exist
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

            records.append(
                Record(
                    patient_id=obj["patient_id"],
                    seq_number=obj.get("seq_number"),
                    date=date_obj,
                    text=obj["text"],
                )
            )

        return records

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse JSON: {e}",
        )


async def parse_concepts_file(
    file: UploadFile, required_columns: list
) -> List[Concept]:
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
                    valid_start_date=datetime.strptime(
                        row["valid_start_date"], "%Y%m%d"
                    ),
                    valid_end_date=datetime.strptime(row["valid_end_date"], "%Y%m%d"),
                    invalid_reason=row.get("invalid_reason"),
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
                entity_name = (
                    term.cluster.title
                    if term.cluster is not None
                    else term.value
                )
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
                entity_name = (
                    term.cluster.title
                    if term.cluster is not None
                    else term.value
                )
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
