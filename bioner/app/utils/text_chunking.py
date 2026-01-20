import re
from typing import List

whitespace_pattern = re.compile(r"\w+(?:[-_]\w+)*|\S")


def trim_medical_text(medical_text: str, max_words: int = 384) -> List[str]:
    """Split text into max_words chunks without altering the original string."""

    if medical_text == "":
        return [medical_text]

    chunks: List[str] = []
    current_start = 0
    tokens_in_chunk = 0

    for match in whitespace_pattern.finditer(medical_text):
        tokens_in_chunk += 1
        if tokens_in_chunk > max_words:
            split_at = match.start()
            if split_at > current_start:
                chunks.append(medical_text[current_start:split_at])
            current_start = split_at
            tokens_in_chunk = 1

    if current_start < len(medical_text):
        chunks.append(medical_text[current_start:])
    elif not chunks:
        chunks.append("")

    return chunks