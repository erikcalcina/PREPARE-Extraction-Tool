from __future__ import annotations

import datetime
import re
from collections import defaultdict
from typing import Optional

from sqlmodel import Session, delete, select, update

from app.library.sentence_segmenter import iter_sentence_spans
from app.models_db import Dataset, Record, SentenceSegment, SourceTerm


_MULTI_SPACE = re.compile(r"\s+")
_TRAILING_PUNCT = re.compile(r"[,\.;:]+$")
_DOT_MONTH = re.compile(r"\b([A-Za-zÀ-ÿČŠŽčšž]{3,})\.(\b|$)")
_HAS_DIGIT = re.compile(r"\d")

_YEAR_ONLY = re.compile(r"^\s*(\d{4})\s*$")
_ISO_YMD = re.compile(r"^\s*(\d{4})[-/](\d{2})[-/](\d{2})\s*$")
_DMY_NUMERIC = re.compile(r"^\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})\s*$")

_DMY_TEXTUAL = re.compile(
    r"^\s*(\d{1,2})\s+([A-Za-zÀ-ÿČŠŽčšž\.]+)(?:\s+(\d{4}))?\s*$",
    re.IGNORECASE,
)

_MONTH_YEAR_TEXTUAL = re.compile(
    r"^\s*([A-Za-zÀ-ÿČŠŽčšž\.]+)\s+(\d{4})\s*$",
    re.IGNORECASE,
)

_MAX_DATE_DISTANCE_CHARS = 120


_MONTH_ALIASES = {
    "gennaio": 1, "gen": 1,
    "febbraio": 2, "feb": 2,
    "marzo": 3, "mar": 3,
    "aprile": 4, "apr": 4,
    "maggio": 5, "mag": 5,
    "giugno": 6, "giu": 6,
    "luglio": 7, "lug": 7,
    "agosto": 8, "ago": 8,
    "settembre": 9, "set": 9, "sett": 9,
    "ottobre": 10, "ott": 10,
    "novembre": 11, "nov": 11,
    "dicembre": 12, "dic": 12,
}


def _normalize_date_text(s: str) -> str:
    s = s.strip()
    s = _TRAILING_PUNCT.sub("", s)
    s = _DOT_MONTH.sub(r"\1", s)
    s = s.replace("\\", "/")
    s = _MULTI_SPACE.sub(" ", s)
    return s


def _safe_datetime(year: int, month: int, day: int):
    try:
        return datetime.datetime(year, month, day)
    except Exception:
        return None


def _visit_date_to_datetime(visit_date):
    if visit_date is None:
        return None

    if isinstance(visit_date, datetime.datetime):
        return visit_date.replace(hour=0, minute=0, second=0, microsecond=0)

    if isinstance(visit_date, datetime.date):
        return datetime.datetime.combine(visit_date, datetime.time.min)

    return None


def _clamp_to_visit_date(parsed_dt, visit_date=None):
    if parsed_dt is None:
        return None

    base_dt = _visit_date_to_datetime(visit_date)
    if base_dt is not None and parsed_dt > base_dt:
        return None

    return parsed_dt


def _try_parse_year_only(text: str, visit_date=None):
    m = _YEAR_ONLY.match(text)
    if not m:
        return None

    year = int(m.group(1))
    parsed = _safe_datetime(year, 1, 1)
    return _clamp_to_visit_date(parsed, visit_date)


def _try_parse_iso_ymd(text: str, visit_date=None):
    m = _ISO_YMD.match(text)
    if not m:
        return None

    y, mo, d = m.group(1), m.group(2), m.group(3)
    parsed = _safe_datetime(int(y), int(mo), int(d))
    return _clamp_to_visit_date(parsed, visit_date)


def _try_parse_dmy_numeric(text: str, visit_date=None):
    m = _DMY_NUMERIC.match(text)
    if not m:
        return None

    d, mo, y = m.group(1), m.group(2), m.group(3)
    parsed = _safe_datetime(int(y), int(mo), int(d))
    return _clamp_to_visit_date(parsed, visit_date)


def _try_parse_textual_day_month(text: str, visit_date=None):
    m = _DMY_TEXTUAL.match(text)
    if not m:
        return None

    day_str, month_str, year_str = m.group(1), m.group(2), m.group(3)
    day = int(day_str)

    normalized_month = month_str.lower().rstrip(".")
    month = _MONTH_ALIASES.get(normalized_month)
    if month is None:
        return None

    if year_str:
        parsed = _safe_datetime(int(year_str), month, day)
        return _clamp_to_visit_date(parsed, visit_date)

    base_dt = _visit_date_to_datetime(visit_date)
    if base_dt is None:
        return None

    candidate = _safe_datetime(base_dt.year, month, day)
    if candidate is None:
        return None

    if candidate > base_dt:
        candidate = _safe_datetime(base_dt.year - 1, month, day)

    return _clamp_to_visit_date(candidate, visit_date)


def _try_parse_textual_month_year(text: str, visit_date=None):
    m = _MONTH_YEAR_TEXTUAL.match(text)
    if not m:
        return None

    month_str, year_str = m.group(1), m.group(2)

    normalized_month = month_str.lower().rstrip(".")
    month = _MONTH_ALIASES.get(normalized_month)
    if month is None:
        return None

    year = int(year_str)
    parsed = _safe_datetime(year, month, 1)
    return _clamp_to_visit_date(parsed, visit_date)


def _parse_date_value(value, visit_date=None):
    if not value:
        return None

    text = _normalize_date_text(value)
    if not text:
        return None

    if _HAS_DIGIT.search(text) is None:
        return None

    year_only_datetime = _try_parse_year_only(text, visit_date)
    if year_only_datetime is not None:
        return year_only_datetime

    iso_datetime = _try_parse_iso_ymd(text, visit_date)
    if iso_datetime is not None:
        return iso_datetime

    dmy_datetime = _try_parse_dmy_numeric(text, visit_date)
    if dmy_datetime is not None:
        return dmy_datetime

    textual_datetime = _try_parse_textual_day_month(text, visit_date)
    if textual_datetime is not None:
        return textual_datetime

    month_year_datetime = _try_parse_textual_month_year(text, visit_date)
    if month_year_datetime is not None:
        return month_year_datetime

    # No generic fallback here on purpose:
    # unclear/relative strings like "circa 11 anni fa" should stay as No date.
    return None


def _build_segments_for_record(record: Record):
    text = record.text or ""

    return [
        SentenceSegment(
            record_id=record.id,
            sequence_index=index,
            start_offset=start,
            end_offset=end,
        )
        for index, (start, end) in enumerate(iter_sentence_spans(text))
    ]


def _assign_terms_to_segments(db: Session, record: Record, segments):
    terms = db.exec(select(SourceTerm).where(SourceTerm.record_id == record.id)).all()

    for term in terms:
        term.sentence_segment_id = None

        start = term.start_position
        end = term.end_position or start

        for segment in segments:
            if start >= segment.start_offset and end <= segment.end_offset:
                term.sentence_segment_id = segment.id
                break


def bulk_insert_records_with_segments(db: Session, records):
    if not records:
        return

    db.add_all(records)
    db.flush()

    segments = []

    for record in records:
        segments.extend(_build_segments_for_record(record))

    if segments:
        db.add_all(segments)

    db.flush()


def regenerate_record_segments(db: Session, record: Record):
    db.exec(
        update(SourceTerm)
        .where(SourceTerm.record_id == record.id)
        .values(sentence_segment_id=None)
    )

    db.exec(delete(SentenceSegment).where(SentenceSegment.record_id == record.id))

    db.flush()

    segments = _build_segments_for_record(record)

    if segments:
        db.add_all(segments)
        db.flush()

        _assign_terms_to_segments(db, record, segments)
        db.flush()


def _is_date_term(term: SourceTerm, date_label: Optional[str]):
    if not date_label:
        return False

    return (term.label or "").lower() == date_label.lower()


def _term_midpoint(term: SourceTerm):
    start = term.start_position or 0
    end = term.end_position or start
    return (start + end) / 2


def _closest_parsed_date_term(entity, date_terms):
    if not date_terms:
        return None

    entity_mid = _term_midpoint(entity)

    best = None
    best_distance = None

    for date_term, parsed_date in date_terms:
        distance = abs(entity_mid - _term_midpoint(date_term))

        if best_distance is None or distance < best_distance:
            best = (date_term, parsed_date)
            best_distance = distance

    if best_distance is None or best_distance > _MAX_DATE_DISTANCE_CHARS:
        return None

    return best


def link_dates_for_record(db: Session, record: Record, dataset: Optional[Dataset] = None):
    dataset = dataset or record.dataset

    if dataset is None:
        dataset = db.get(Dataset, record.dataset_id)

    terms = db.exec(select(SourceTerm).where(SourceTerm.record_id == record.id)).all()

    if not terms:
        return

    date_label = dataset.date_label
    fallback_date = _visit_date_to_datetime(record.visit_date)

    parsed_date_terms = []

    # First pass: parse only explicit date terms
    for term in terms:
        if _is_date_term(term, date_label):
            parsed = _parse_date_value(term.value, fallback_date)

            term.linked_date_term_id = None
            term.linked_visit_date = parsed

            if parsed is not None:
                parsed_date_terms.append((term, parsed))

    # Second pass: link all non-date terms to nearest parsed date in the record
    # If none exists, fallback to visit_date
    for term in terms:
        if _is_date_term(term, date_label):
            continue

        closest = _closest_parsed_date_term(term, parsed_date_terms)

        if closest:
            date_term, parsed_date = closest
            term.linked_date_term_id = date_term.id
            term.linked_visit_date = parsed_date
        else:
            term.linked_date_term_id = None
            term.linked_visit_date = fallback_date

    db.flush()