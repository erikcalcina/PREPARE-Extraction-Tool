from __future__ import annotations

import re
import warnings
from typing import Optional, Tuple

import dateparser
from babel.dates import format_datetime

# We can keep this list small at first; expand later if needed
POSSIBLE_FORMATS = [
    "dd.MM.yyyy",
    "dd-MM-yyyy",
    "dd/MM/yyyy",
    "yyyy-MM-dd",
]

MEASURE_UNITS = r"(mg|ml|g|mcg|µg|kg|iu|%)"
MEASURE_RE = re.compile(
    rf"^\s*\d+(?:\s*/\s*\d+)?(?:[.,]\d+)?\s*{MEASURE_UNITS}\s*$",
    re.IGNORECASE,
)

DATE_SEP_RE = re.compile(r"[.\-/]")


def detect_datetime_format(dt_str: str, lang: str) -> Tuple[object, Optional[str]]:
    """
    Ported idea from anonipy:
    detect date and its format using dateparser + babel.
    Returns (parsed_datetime, format) or (None, None).
    """
    s = (dt_str or "").strip()
    if not s:
        return None, None

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=DeprecationWarning)
            parsed_dt = dateparser.parse(s, languages=[lang])

        if parsed_dt is None:
            return None, None

        for fmt in POSSIBLE_FORMATS:
            try:
                # babel formatting output must match input exactly to confirm format
                formatted = format_datetime(parsed_dt, format=fmt, locale=lang)
                if formatted == s:
                    return parsed_dt, fmt
            except ValueError:
                continue

        # If parsed but format not confidently detected, still return parsed_dt
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

    # remove spaces around dots/commas in decimals (optional)
    s = s.replace(" ,", ",").replace(", ", ",").replace(" .", ".").replace(". ", ".")

    if not re.search(r"\b(mg|ml|g|mcg|µg|kg|iu|%)\b", s):
        return None

    return s


def detect_value_type(text: str) -> str:
    """
    Decide which pipeline to use:
      - date: looks like date
      - measure: looks like dosage/unit
      - text: default
    """
    s = (text or "").strip()
    if not s:
        return "text"

    # measure check first (often contains digits too)
    if MEASURE_RE.match(s.replace(" ", "")) or MEASURE_RE.match(s):
        return "measure"

    # date-like check: digits + separators
    if any(ch.isdigit() for ch in s) and DATE_SEP_RE.search(s):
        return "date"

    return "text"
