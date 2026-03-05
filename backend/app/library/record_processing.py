from __future__ import annotations

import datetime
from collections import defaultdict
from typing import List, Optional, Sequence, Tuple

import dateparser
from sqlmodel import Session, delete, select

from app.library.sentence_segmenter import iter_sentence_spans
from app.models_db import Dataset, Record, SentenceSegment, SourceTerm


def _build_sentence_segments(record: Record) -> List[SentenceSegment]:
    spans = list(iter_sentence_spans(record.text or ""))
    segments: List[SentenceSegment] = []
    for index, (start, end) in enumerate(spans):
        segments.append(
            SentenceSegment(
                record_id=record.id,
                sequence_index=index,
                start_offset=start,
                end_offset=end,
            )
        )
    if not segments and record.text:
        segments.append(
            SentenceSegment(
                record_id=record.id,
                sequence_index=0,
                start_offset=0,
                end_offset=len(record.text),
            )
        )
    return segments


def bulk_insert_records_with_segments(db: Session, records: Sequence[Record]) -> None:
    if not records:
        return

    db.bulk_save_objects(records, return_defaults=True)
    db.flush()

    segments: List[SentenceSegment] = []
    for record in records:
        if record.id is None:
            continue
        segments.extend(_build_sentence_segments(record))

    if segments:
        db.bulk_save_objects(segments, return_defaults=True)

    db.commit()


def regenerate_record_segments(db: Session, record: Record) -> None:
    db.exec(delete(SentenceSegment).where(SentenceSegment.record_id == record.id))
    segments = _build_sentence_segments(record)
    if segments:
        db.bulk_save_objects(segments, return_defaults=True)
    db.flush()


def _ensure_sentence_assignment(
    term: SourceTerm,
    segments: Sequence[SentenceSegment],
) -> None:
    if term.sentence_segment_id is not None:
        return
    if term.start_position is None:
        return
    end = term.end_position if term.end_position is not None else term.start_position
    for segment in segments:
        if (
            segment.start_offset <= term.start_position
            and end <= segment.end_offset
        ):
            term.sentence_segment_id = segment.id
            return


def _term_midpoint(
    term: SourceTerm,
    segment_lookup: dict[int | None, SentenceSegment],
) -> float:
    start = term.start_position
    end = term.end_position
    if start is None or end is None:
        segment = segment_lookup.get(term.sentence_segment_id)
        if segment:
            if start is None:
                start = segment.start_offset
            if end is None:
                end = segment.end_offset
    if start is None:
        start = 0
    if end is None:
        end = start
    return (start + end) / 2.0


def _parse_date_value(value: Optional[str]):
    if not value:
        return None
    try:
        return dateparser.parse(value)
    except Exception:
        return None


def link_dates_for_record(
    db: Session,
    record: Record,
    dataset: Optional[Dataset] = None,
) -> None:
    dataset = dataset or record.dataset
    if dataset is None:
        dataset = db.get(Dataset, record.dataset_id)
        if dataset is None:
            return

    terms = db.exec(select(SourceTerm).where(SourceTerm.record_id == record.id)).all()
    if not terms:
        return

    segments = db.exec(
        select(SentenceSegment)
        .where(SentenceSegment.record_id == record.id)
        .order_by(SentenceSegment.sequence_index)
    ).all()

    if not segments and record.text:
        regenerate_record_segments(db, record)
        segments = db.exec(
            select(SentenceSegment)
            .where(SentenceSegment.record_id == record.id)
            .order_by(SentenceSegment.sequence_index)
        ).all()

    segment_lookup = {segment.id: segment for segment in segments}

    for term in terms:
        # Preserve manually set linked dates
        if not getattr(term, "manual_linked_visit_date", False):
            term.linked_date_term_id = None
            term.linked_visit_date = None
        _ensure_sentence_assignment(term, segments)

    grouped = defaultdict(list)
    for term in terms:
        grouped[term.sentence_segment_id].append(term)

    date_label = dataset.date_label
    fallback_date = record.visit_date

    for segment_id, segment_terms in grouped.items():
        if not date_label:
            for term in segment_terms:
                term.linked_visit_date = fallback_date
            continue

        date_terms: List[Tuple[SourceTerm, Optional[datetime.datetime]]] = []
        for term in segment_terms:
            if term.label == date_label:
                parsed = _parse_date_value(term.value)
                # Do not overwrite manual dates
                if not getattr(term, "manual_linked_visit_date", False):
                    term.linked_visit_date = parsed
                date_terms.append((term, parsed))

        non_date_terms = [t for t in segment_terms if t.label != date_label]

        valid_dates = [(t, dt) for t, dt in date_terms if dt is not None]

        if len(valid_dates) == 1:
            date_term, parsed_dt = valid_dates[0]
            for entity in non_date_terms:
                # Do not overwrite manually set dates on entities
                if not getattr(entity, "manual_linked_visit_date", False):
                    entity.linked_date_term_id = date_term.id
                    entity.linked_visit_date = parsed_dt
        elif len(valid_dates) > 1:
            date_midpoints = {
                dt_term.id: _term_midpoint(dt_term, segment_lookup)
                for dt_term, _ in valid_dates
            }
            for entity in non_date_terms:
                entity_mid = _term_midpoint(entity, segment_lookup)
                closest_term_id = None
                closest_dt = None
                closest_distance = None
                for dt_term, parsed_dt in valid_dates:
                    mid = date_midpoints[dt_term.id]
                    distance = abs(entity_mid - mid)
                    if closest_distance is None or distance < closest_distance:
                        closest_distance = distance
                        closest_term_id = dt_term.id
                        closest_dt = parsed_dt
                if not getattr(entity, "manual_linked_visit_date", False):
                    entity.linked_date_term_id = closest_term_id
                    entity.linked_visit_date = closest_dt
        else:
            for entity in non_date_terms:
                if not getattr(entity, "manual_linked_visit_date", False):
                    entity.linked_visit_date = fallback_date

    db.flush()
