import litserve as ls
import logging
from argparse import ArgumentParser
from app.interfaces import NERRequest
from app.engines import build_engine

logging.basicConfig(level=logging.INFO)

class NERAPI(ls.LitAPI):
    def __init__(self, model_name: str, use_gpu: bool):
        super().__init__()
        self.model_name = model_name
        self.use_gpu = use_gpu
        
    def setup(self, device):
        self.model = build_engine(self.model_name, use_gpu=self.use_gpu)

    def decode_request(self, request: NERRequest) -> dict:
        return {
            "medical_text": request.medical_text,
            "labels": request.labels or [],
        }

    def predict(self, inputs: dict) -> dict:
        return self.model.extract_entities(medical_text=inputs["medical_text"], labels=inputs["labels"])

    def encode_response(self, output):
        return output

if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--model_name", type=str, 
                        help="""Name of the model to use. 
                        For LLM: llm:hf_path@adapter_path
                        For GLiNER: gliner:urchade/gliner_medium-v2.1
                        """
                        )
    parser.add_argument("--use_gpu",
                        action="store_true",
                        help="Flag to use GPU for inference."
                        )
    args = parser.parse_args()
    api = NERAPI(model_name=args.model_name, use_gpu=args.use_gpu)
    server = ls.LitServer(api, accelerator="auto", timeout=300, api_path="/ner")
    server.run(port=8000)
