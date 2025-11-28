import pytest

from app.engines import build_engine
from app.engines.gliner_engine import GlinerEngine
from app.engines.llm_engine_huggingface import LLMEngineHuggingFace

SAMPLE_TEXT = (
    "L'esame obiettivo condotto al mattino mostra un soggetto vigile orientato collaborante; "
    "il quadro neurologico è dominato da disturbi assiali, per anomalia della postura del tronco."
)
SAMPLE_LABELS = [
    "Farmaco",
    "Dose del farmaco",
    "Sintomi",
    "Comorbidità",
    "Data",
    "Riabilitazione",
    "Test",
    "Punteggi Test",
    "Eventi",
]
ADAPTER_PATH = "path/to/adapter/model"  # Replace with actual adapter model path
GLINER_MODEL = "urchade/gliner_medium-v2.1"
LLM_MODEL = "meta-llama/Llama-3.1-8B-Instruct"

def _assert_entities_structure(entities):
    assert entities, "Expected at least one entity from engine"
    for entity in entities:
        assert entity.text
        assert entity.label in SAMPLE_LABELS
        assert 0 <= entity.start < entity.end <= len(SAMPLE_TEXT)

def test_gliner_model_loads_on_cpu():
    engine = build_engine(
        engine="gliner",
        model=GLINER_MODEL,
        adapter_model=None,
        prompt_path=None,
        use_gpu=False,
    )
    assert isinstance(engine, GlinerEngine)
    assert engine.device == "cpu"

def test_gliner_model_loads_on_gpu():
    engine = build_engine(
        engine="gliner",
        model="urchade/gliner_medium-v2.1",
        adapter_model=None,
        prompt_path=None,
        use_gpu=True,
    )
    assert isinstance(engine, GlinerEngine)
    assert engine.device == "cuda"

def test_llm_model_loads_on_gpu():
    engine = build_engine(
        engine="huggingface",
        model=LLM_MODEL,
        adapter_model=None,
        prompt_path=None,
        use_gpu=True,
    )
    assert isinstance(engine, LLMEngineHuggingFace)
    assert engine.device == "cuda"

def test_llm_model_loads_with_adapter_on_gpu():
    engine = build_engine(
        engine="huggingface",
        model=LLM_MODEL,
        adapter_model=ADAPTER_PATH,
        prompt_path=None,
        use_gpu=True,
    )
    assert isinstance(engine, LLMEngineHuggingFace)
    assert engine.device == "cuda"

def test_invalid_engine_raises_value_error():
    with pytest.raises(ValueError) as excinfo:
        build_engine(
            engine="invalid_engine",
            model="some_model",
            adapter_model=None,
            prompt_path=None,
            use_gpu=True,
        )
    assert "Unknown model type" in str(excinfo.value)

def test_gliner_model_extracts_entities_from_sample_text():
    engine = build_engine(
        engine="gliner",
        model=GLINER_MODEL,
        adapter_model=None,
        prompt_path=None,
        use_gpu=True,
    )
    entities = engine.extract_entities(SAMPLE_TEXT, SAMPLE_LABELS)
    print("=================================================")
    print(entities)
    print("=================================================")
    _assert_entities_structure(entities)

def test_llm_model_extracts_entities_from_sample_text():
    engine = build_engine(
        engine="huggingface",
        model=LLM_MODEL,
        adapter_model=None,
        prompt_path=None,
        use_gpu=True,
    )
    entities = engine.extract_entities(SAMPLE_TEXT, SAMPLE_LABELS)
    print("=================================================")
    print(entities)
    print("=================================================")
    _assert_entities_structure(entities)

def test_llm_model_with_adapter_extracts_entities_from_sample_text():
    engine = build_engine(
        engine="huggingface",
        model=LLM_MODEL,
        adapter_model=ADAPTER_PATH,
        prompt_path=None,
        use_gpu=True,
    )
    entities = engine.extract_entities(SAMPLE_TEXT, SAMPLE_LABELS)
    print("=================================================")
    print(entities)
    print("=================================================")
    _assert_entities_structure(entities)