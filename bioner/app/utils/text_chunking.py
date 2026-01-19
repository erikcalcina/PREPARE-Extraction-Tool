import re
from typing import List

whitespace_pattern = re.compile(r'\w+(?:[-_]\w+)*|\S')

def trim_medical_text(medical_text: str, max_words: int = 384) -> List[str]:
    """
    Split text into sentence-based chunks that do not exceed max_tokens,
    counting tokens with GLiNER's whitespace regex.
    """
    # TODO: check if it performs well if the text contains empty sentences
    # Split into sentences retaining the period
    sentences = re.findall(r'[^\n\.\?\!]+(?:[\.\?\!\n]|$)', medical_text)
    if not sentences:
        sentences = [medical_text]

    chunks: List[str] = []
    current_chunk = ""

    def token_len(text: str) -> int:
        # Count tokens using GLiNER-like whitespace splitting
        return len(whitespace_pattern.findall(text))

    # TODO: handle cases where a single sentence exceeds max_tokens
    for sentence in sentences:
        # If adding this sentence exceeds the token limit → new chunk
        if current_chunk and token_len(current_chunk + sentence) > max_words:
            chunks.append(current_chunk)
            current_chunk = sentence
        else:
            current_chunk += sentence

    if current_chunk:
        chunks.append(current_chunk)

    return chunks