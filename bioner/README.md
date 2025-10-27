# bioner

Lightweight API service to extract named entities from medical text. Provides two engines:
- LLM engine: app.engines.llm_engine_huggingface.LLMEngineHuggingFace (local Hugging Face models, optional adapters).
- Gliner engine: app.engines.gliner_engine.GlinerEngine (fast deterministic NER).

## ☑️ Requirements

Before starting make sure these are available:

- python (version >= 3.10)
- git
- (required) CUDA drivers and a GPU if you plan to run quantized LLM engine
- (Optional) docker and docker-compose for containerized runs

## 🛠️ Setup

### Create a python environment

```bash
# from project root or the bioner folder
python -m venv .venv

# activate (UNIX)
source .venv/bin/activate

# deactivate
deactivate
```

### Install the requirements

Run the following command to install the requirements:

```bash
pip install -e .[dev]
```

## 🧪 Development

Start the server in development mode by running the main entrypoint. main.py launches a LitServe instance exposing POST /ner.

Example (LLM engine):

```bash
python app/main.py \
  --model_type huggingface \
  --model_path model_hf_id \
  --prompt_path /full/path/to/prompts.json \
  --adapter_path /full/path/to/adapter_or_empty \
  --use_gpu
```

Example (Gliner engine):

```bash
python app/main.py --model_type gliner --model_path /full/path/to/gliner/config
```

Server listens on port 8000 by default. Test with curl:

```bash
curl -sS -X POST http://localhost:8000/ner \
  -H "Content-Type: application/json" \
  -d '{"medical_text":"Patient has fever and cough.","labels":["DISEASE","SYMPTOM"]}'
```

## 🐳 Dockerize (TODO)

