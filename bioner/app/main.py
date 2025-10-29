import litserve as ls
import logging
from argparse import ArgumentParser
from app.interfaces import NERRequest
from app.engines import build_engine

logging.basicConfig(level=logging.INFO)

class NERAPI(ls.LitAPI):
    def __init__(self, 
                 model_type: str, 
                 model_path: str, 
                 adapter_path: str | None = None,
                 prompt_path: str | None = None,
                 use_gpu: bool = False):
        super().__init__()
        self.model_type = model_type
        self.model_path = model_path
        self.adapter_path = adapter_path
        self.prompt_path = prompt_path
        self.use_gpu = use_gpu

    def setup(self, device):
        self.model = build_engine(
            model_type=self.model_type, 
            model_path=self.model_path, 
            adapter_path=self.adapter_path, 
            prompt_path=self.prompt_path,
            use_gpu=self.use_gpu)

    def decode_request(self, request: NERRequest) -> dict:
        return {
            "medical_text": request.medical_text,
            "labels": request.labels or [],
        }

    def predict(self, inputs: dict) -> dict:
        return self.model.extract_entities(medical_text=inputs["medical_text"], 
                                           labels=inputs["labels"])

    def encode_response(self, output):
        return output

if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--model_type",
                        type=str,
                        choices=["huggingface", "gliner"],
                        help="Type of model to use: 'huggingface' for Hugging Face LLM models or 'gliner' for GLiNER model."
    )
    parser.add_argument("--model_path",
                        type=str,
                        help="Path to the model to use."
                        )
    parser.add_argument("--adapter_path",
                        type=str,
                        help="Path to the LLM adapter to use (if any)."
                        )
    parser.add_argument("--prompt_path",
                        type=str,
                        help="Path to the prompts file to use (if any)."
                        )
    parser.add_argument("--use_gpu",
                        action="store_true",
                        help="Flag to use GPU for inference."
                        )
    parser.add_argument("--host",
                        type=str,
                        default="0.0.0.0",
                        help="Host to run the server on."
                        )
    parser.add_argument("--port",
                        type=int,
                        default=8000,
                        help="Port to run the server on."
                        )
    args = parser.parse_args()
    api = NERAPI(
        model_type=args.model_type,
        model_path=args.model_path,
        adapter_path=args.adapter_path,
        prompt_path=args.prompt_path,
        use_gpu=args.use_gpu
    )
    server = ls.LitServer(api, accelerator="auto", timeout=300, api_path="/ner")
    server.run(host=args.host, port=args.port)
