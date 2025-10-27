import torch
from typing import Any
from .gliner_engine import GlinerEngine
from .llm_engine_huggingface import LLMEngineHuggingFace

def build_engine(model_type=str, 
                 model_path=str, 
                 adapter_path=str | None, 
                 prompt_path=str | None, 
                 use_gpu=True) -> Any:
    # Determine device
    device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
    # Build and return the appropriate engine
    if model_type == "gliner":
        return GlinerEngine(model_path=model_path, 
                            device=device)
    elif model_type == "huggingface":
        return LLMEngineHuggingFace(model_path=model_path, 
                                    adapter_path=adapter_path, 
                                    device=device, 
                                    prompts_path=prompt_path)
    else:
        raise ValueError(f"Unknown model type '{model_type}'. Use 'gliner' or 'huggingface'.")

__all__ = ["build_engine"]