from __future__ import annotations

import datetime
import re
import warnings
from typing import Optional, Tuple

import dateparser
from babel.dates import format_datetime

POSSIBLE_FORMATS = [
    # numeric + time
    "yyyy-MM-dd HH:mm:ss",
    "dd-MM-yyyy HH:mm:ss",
    "MM-dd-yyyy HH:mm:ss",
    "yyyy/MM/dd HH:mm:ss",
    "dd/MM/yyyy HH:mm:ss",
    "MM/dd/yyyy HH:mm:ss",
    "yyyy.MM.dd HH:mm:ss",
    "dd.MM.yyyy HH:mm:ss",
    "d.M.yyyy HH:mm:ss",
    "MM.dd.yyyy HH:mm:ss",
    "yyyy-MM-dd HH:mm",
    "dd-MM-yyyy HH:mm",
    "MM-dd-yyyy HH:mm",
    "yyyy/MM/dd HH:mm",
    "dd/MM/yyyy HH:mm",
    "MM/dd/yyyy HH:mm",
    "yyyy.MM.dd HH:mm",
    "dd.MM.yyyy HH:mm",
    "d.M.yyyy HH:mm",
    "MM.dd.yyyy HH:mm",
    # numeric only
    "yyyy-MM-dd",
    "dd-MM-yyyy",
    "MM-dd-yyyy",
    "yyyy/MM/dd",
    "dd/MM/yyyy",
    "MM/dd/yyyy",
    "yyyy.MM.dd",
    "dd.MM.yyyy",
    "d.M.yyyy",
    "MM.dd.yyyy",
    # month names (full/short) + optional dot after day
    "d MMMM yyyy HH:mm:ss",
    "d MMMM yyyy HH:mm",
    "d MMMM yyyy",
    "d. MMMM yyyy HH:mm:ss",
    "d. MMMM yyyy HH:mm",
    "d. MMMM yyyy",
    "d MMM yyyy HH:mm:ss",
    "d MMM yyyy HH:mm",
    "d MMM yyyy",
    "d. MMM yyyy HH:mm:ss",
    "d. MMM yyyy HH:mm",
    "d. MMM yyyy",
    # weekday + month names
    "EEE, d MMMM yyyy HH:mm:ss",
    "EEE, d MMMM yyyy HH:mm",
    "EEE, d MMMM yyyy",
    "EEE, d MMMM, yyyy HH:mm:ss",
    "EEE, d MMMM, yyyy HH:mm",
    "EEE, d MMMM, yyyy",
    "EEE, d. MMMM yyyy HH:mm:ss",
    "EEE, d. MMMM yyyy HH:mm",
    "EEE, d. MMMM yyyy",
    "EEE, d. MMMM, yyyy HH:mm:ss",
    "EEE, d. MMMM, yyyy HH:mm",
    "EEE, d. MMMM, yyyy",
    "EEE, MMMM d, yyyy HH:mm:ss",
    "EEE, MMMM d, yyyy HH:mm",
    "EEE, MMMM d, yyyy",
    "EEE, MMMM d yyyy HH:mm:ss",
    "EEE, MMMM d yyyy HH:mm",
    "EEE, MMMM d yyyy",
    "EEEE, d MMMM yyyy HH:mm:ss",
    "EEEE, d MMMM yyyy HH:mm",
    "EEEE, d MMMM yyyy",
    "EEEE, d MMMM, yyyy HH:mm:ss",
    "EEEE, d MMMM, yyyy HH:mm",
    "EEEE, d MMMM, yyyy",
    "EEEE, d. MMMM yyyy HH:mm:ss",
    "EEEE, d. MMMM yyyy HH:mm",
    "EEEE, d. MMMM yyyy",
    "EEEE, d. MMMM, yyyy HH:mm:ss",
    "EEEE, d. MMMM, yyyy HH:mm",
    "EEEE, d. MMMM, yyyy",
    "EEEE, MMMM d, yyyy HH:mm:ss",
    "EEEE, MMMM d, yyyy HH:mm",
    "EEEE, MMMM d, yyyy",
    "EEEE, MMMM d yyyy HH:mm:ss",
    "EEEE, MMMM d yyyy HH:mm",
    "EEEE, MMMM d yyyy",
    # Spanish/Portuguese style "de"
    "d 'de' MMMM 'de' yyyy HH:mm:ss",
    "d 'de' MMMM 'de' yyyy HH:mm",
    "d 'de' MMMM 'de' yyyy",
    "EEEE, d 'de' MMMM 'de' yyyy HH:mm:ss",
    "EEEE, d 'de' MMMM 'de' yyyy HH:mm",
    "EEEE, d 'de' MMMM 'de' yyyy",
    "EEEE, MMMM d 'de' yyyy HH:mm:ss",
    "EEEE, MMMM d 'de' yyyy HH:mm",
    "EEEE, MMMM d 'de' yyyy",
    # common English month-first
    "MMM d, yyyy HH:mm:ss",
    "MMM d, yyyy HH:mm",
    "MMM d, yyyy",
    "EEE, MMM d, yyyy HH:mm:ss",
    "EEE, MMM d, yyyy HH:mm",
    "EEE, MMM d, yyyy",
]

# =====================================
# Measures / type detection
# =====================================

MEASURE_UNITS = r"(mg|ml|g|mcg|µg|kg|iu|%)"
MEASURE_RE = re.compile(
    rf"^\s*\d+(?:\s*/\s*\d+)?(?:[.,]\d+)?\s*{MEASURE_UNITS}\s*$",
    re.IGNORECASE,
)

DATE_SEP_RE = re.compile(r"[.\-/]")

# "date with month name" heuristic: has digits AND letters (latin/cyrillic + accents)
DATE_WORDLIKE_RE = re.compile(r"(?=.*\d)(?=.*[A-Za-zА-Яа-яÀ-ÿ])")


def _prepare_datetime(dt_str: str, lang: str) -> str:
    """
    Prepare datetime string for matching against babel output:
    - normalize case for most langs
    - remove AM/PM markers
    - remove some language-specific tokens/suffixes
    - collapse whitespace
    """
    s = (dt_str or "").strip()
    if not s:
        return s

    # In many locales babel uses case-sensitive month/weekday names;
    # the original logic lowercases for most, except these.
    if lang not in ["en", "de", "el"]:
        s = s.lower()

    # Remove AM/PM
    s = re.sub(r"[ ]?[APap][mM]", "", s).strip()

    # Language-specific cleaning (same spirit as your reference)
    s = re.sub(r"\b1er\b", "1", s)           # French "1er"
    s = re.sub(r"(\d+)η", r"\1", s)          # Greek ordinal
    s = re.sub(r"\bτου\b", "", s)            # Greek filler
    s = re.sub(r"°", "", s)                  # Italian/Spanish sometimes
    s = re.sub(r"\bроку\b", "", s)           # Ukrainian "року"

    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


def detect_datetime_format(dt_str: str, lang: str) -> Tuple[Optional[datetime.datetime], Optional[str]]:
    """
    Detect date/datetime and its format using dateparser + babel.
    Returns (parsed_datetime, format) or (None, None).
    """
    raw = (dt_str or "").strip()
    if not raw:
        return None, None

    s = _prepare_datetime(raw, lang)

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=DeprecationWarning)
            parsed_dt = dateparser.parse(s, languages=[lang])

        if parsed_dt is None:
            return None, None

        for fmt in POSSIBLE_FORMATS:
            try:
                formatted = format_datetime(parsed_dt, format=fmt, locale=lang)
                if formatted == s:
                    return parsed_dt, fmt
            except ValueError:
                continue

        # Parsed, but couldn't match exactly -> fallback
        return parsed_dt, "yyyy-MM-dd"

    except Exception:
        return None, None


def normalize_date_to_key(dt_str: str, lang: str = "en") -> Optional[str]:
    """
    Convert many date strings to a canonical key YYYY-MM-DD.
    If not confidently parseable -> None.
    """
    parsed_dt, _fmt = detect_datetime_format(dt_str, lang=lang)
    if parsed_dt is None:
        return None
    return parsed_dt.strftime("%Y-%m-%d")


def normalize_measure_to_key(text: str) -> Optional[str]:
    """
    Normalize measures but keep numeric meaning:
    - collapse spaces
    - turn separators into spaces
    - ensure unit separated
    Example:
      '2/50mg' -> '2 50 mg'
      '2   50mg' -> '2 50 mg'
    """
    s = (text or "").strip().lower()
    if not s:
        return None
    s = s.replace("/", " ")
    s = re.sub(r"\s+", " ", s).strip()

    # ensure space before unit: "50mg" -> "50 mg"
    s = re.sub(r"(\d)(mg|ml|g|mcg|µg|kg|iu|%)\b", r"\1 \2", s)

    # cleanup spaces around punctuation
    s = s.replace(" ,", ",").replace(", ", ",").replace(" .", ".").replace(". ", ".")

    if not re.search(r"\b(mg|ml|g|mcg|µg|kg|iu|%)\b", s):
        return None

    return s


def detect_value_type(text: str) -> str:
    """
    Decide which pipeline to use:
      - date: looks like date (numeric with separators OR word-month style)
      - measure: looks like dosage/unit
      - text: default
    """
    s = (text or "").strip()
    if not s:
        return "text"

    # measure check first (often contains digits too)
    compact = s.replace(" ", "")
    if MEASURE_RE.match(compact) or MEASURE_RE.match(s):
        return "measure"

    # numeric date-like: digits + separators
    if any(ch.isdigit() for ch in s) and DATE_SEP_RE.search(s):
        return "date"

    # wordy date-like: digits + letters (e.g. "12 March 2024", "Пн, 5 сен 2023")
    if DATE_WORDLIKE_RE.search(s):
        return "date"

    return "text"
