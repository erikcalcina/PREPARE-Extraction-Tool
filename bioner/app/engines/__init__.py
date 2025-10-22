import torch
from typing import Any
from .gliner_engine import GlinerEngine
from .llm_engine import LLMEngine

def build_engine(spec: str, use_gpu=True) -> Any:
    """
    spec formats:
      - "gliner:urchade/gliner_medium-v2.1"
      - "llm:meta-llama/Llama-3.1-8B-Instruct@llama-ner-lora-adapter"
      - "llm:google/gemma-2-9b-it"
    """
    device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
    if ":" not in spec:
        raise ValueError("spec must look like '<family>:<rest>'")
    family, rest = spec.split(":", 1)
    family = family.lower()

    if family == "gliner":
        return GlinerEngine(model_name=rest, device=device)

    if family == "llm":
        if "@" in rest:
            model_name, adapter_path = rest.split("@", 1)
            print(f"Using base model '{model_name}' with adapter '{adapter_path}'")
        else:
            model_name, adapter_path = rest, None
        return LLMEngine(model_name=model_name, adapter_path=adapter_path, device=device)

    raise ValueError(f"Unknown family '{family}'. Use 'gliner:' or 'llm:'")


__all__ = ["build_engine"]