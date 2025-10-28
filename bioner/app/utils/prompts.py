import os
import json

class Prompts:
    def __init__(self, prompts_path: str | None = None):
        if prompts_path is None:
            prompts_path = os.path.join(os.path.dirname(__file__), "prompts.json")
        if not os.path.exists(prompts_path):
            raise FileNotFoundError(f"prompts path not found at: {prompts_path}")
        with open(prompts_path, "r") as file:
            self.data = json.load(file)

    def _get_output_structure(self, label: str, output_type="instruction_training") -> dict:
        return self.data[output_type]["labels"][label]["output_structure"]

    def _get_system_prompt(self, type: str) -> str:
        return self.data[type]["system_prompt"]

    def _create_instruction_prompt(self, labels: list[str], output_structure: dict, medical_text: str, output_type: str) -> str:
        output_structure = json.dumps(output_structure)
        labels_string = ', '.join(str(label) for label in labels)
        instruction_content = "Please extract the following entities: " + labels_string + ". Answer must follow the following format:\n[" + output_structure + "...]"
        prompt = self._get_system_prompt(output_type) + "\n\n" + instruction_content + "\n\nMedical text:\n" + medical_text
        return prompt
    
    def create_instruction_message(self, labels: list[str], medical_text: str) -> dict:
        message = {}
        output_structure = self._get_output_structure("no_label", output_type="instruction_training")
        message["prompt"] = self._create_instruction_prompt(labels, output_structure, medical_text, output_type="instruction_training")
        return message