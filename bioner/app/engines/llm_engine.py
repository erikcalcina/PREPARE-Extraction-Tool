from typing import List, Any

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

from app.interfaces import Entity
from .base_engine import BaseEngine
from ..utils import parse_response, find_entity_spans
from ..utils.prompts import Prompts

class LLMEngine(BaseEngine):
    def __init__(self, model_name="meta-llama/Llama-3.1-8B-Instruct", device="cuda", labels: list[str] | None = None, adapter_path: str | None = None, max_new_tokens=4000, temperature=0.001, top_p=0.95):
        super().__init__(model_name=model_name, device=device)
        self.labels = labels
        self.adapter_path = adapter_path
        self.max_new_tokens = max_new_tokens
        self.temperature = temperature
        self.top_p = top_p
        self._initialize()

    def _initialize(self):
        # Initialize tokenizer and model with quantization and optional adapter
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, padding_side="right", use_fast=False)
        self.tokenizer.pad_token = self.tokenizer.eos_token
        quantization_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            quantization_config=quantization_config,
        )
        if self.adapter_path:
            self.model = PeftModel.from_pretrained(self.model, self.adapter_path)
        self.model = self.model.to(self.device)

    def extract_entities(self, medical_text: str, labels: list[str]) -> List[Entity]:
        # Create prompt
        prompts = Prompts()
        message = prompts.create_instruction_message(labels=labels, medical_text=medical_text)
        input_ids = instructions_formatting_function(message, self.tokenizer)
        # Generate response
        input_ids = input_ids.to(self.model.device)
        with torch.no_grad():
            output_ids = self.model.generate(
                input_ids,
                max_new_tokens=self.max_new_tokens,
                temperature=self.temperature,
                top_p=self.top_p,
                do_sample=True,
            )
        response = self.tokenizer.decode(output_ids[0][len(input_ids[0]):], skip_special_tokens=True)
        # Parse response
        entities = parse_response(response)
        spans = find_entity_spans(medical_text, entities)
        return spans

def instructions_formatting_function(examples: dict[str, str] | list[dict[str, str]], tokenizer: Any) -> Any:
    """
    Input should look like a list of dictionaries:
        [ {'prompt': 'some prompt'} ]
    Or a single example like:
        {'prompt': 'some prompt'}
    """
    if isinstance(examples, list):
        output_texts = []
        for i in range(len(examples)):
            converted_sample = [
                {"role": "user", "content": examples[i]["prompt"]},
            ]
            output_texts.append(tokenizer.apply_chat_template(converted_sample, tokenize=True, return_tensors="pt", add_generation_prompt=True))
        return output_texts
    else:
        converted_sample = [
            {"role": "user", "content": examples["prompt"]},
        ]
        return tokenizer.apply_chat_template(converted_sample, tokenize=True, return_tensors="pt", add_generation_prompt=True)