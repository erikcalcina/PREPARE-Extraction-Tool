import gc
import json
import logging
import os
import tempfile
import threading
from typing import Optional, Any
from datetime import datetime

import torch

from app.engines import build_engine
from app.interfaces import ModelInfo, ModelHealthCheck, AvailableModel, AvailableModelsResponse

logger = logging.getLogger(__name__)

# =========================
# SHARED STORAGE (BACKEND + BIONER)
# =========================
MODEL_ROOT = os.getenv(
    "MODEL_STORE_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../model_store"))
)

RUNS_DIR = os.path.join(MODEL_ROOT, "runs")
LATEST_FILE = os.path.join(MODEL_ROOT, "latest.json")


class ModelManager:
    _instance: Optional["ModelManager"] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True
        self._switch_lock = threading.RLock()

        self._model_instance: Optional[Any] = None
        self._current_model_path: Optional[str] = None
        self._current_engine: Optional[str] = None
        self._current_device: Optional[str] = None

        self._is_loading = False
        self._load_error = None

    # =========================
    # READ LATEST MODEL
    # =========================
    def get_latest_model_path(self) -> Optional[str]:
        try:
            if not os.path.exists(LATEST_FILE):
                logger.warning("latest.json not found")
                return None

            with open(LATEST_FILE, "r") as f:
                data = json.load(f)

            return data.get("path")

        except Exception as e:
            logger.warning(f"Error during model unload: {e}")

    def _snapshot(self) -> dict:
        """Create snapshot of current model state for serialization."""
        return {
            "engine": self._current_engine,
            "model": self._current_model_path,
            "adapter_model": self._current_adapter_model,
            "prompt_path": self._current_prompt_path,
            "use_gpu": self._use_gpu,
        }

    def _write_state_dict(self, state: dict) -> None:
        """Write arbitrary state dict to file atomically."""
        try:
            state_dir = os.path.dirname(self._state_path)
            os.makedirs(state_dir, exist_ok=True)

            temp_fd, temp_path = tempfile.mkstemp(dir=state_dir, text=True)
            try:
                with os.fdopen(temp_fd, 'w') as f:
                    json.dump(state, f)
                os.replace(temp_path, self._state_path)
                logger.debug(f"State written to {self._state_path}")
            except Exception:
                os.close(temp_fd)
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                raise
        except Exception as e:
            logger.error(f"Failed to write state file: {e}")
            raise

    def _write_state(self) -> None:
        """Write current model state snapshot to file."""
        self._write_state_dict(self._snapshot())

    def set_training_active(self, active: bool, pre_training_state: Optional[dict] = None) -> Optional[dict]:
        """
        Coordinate model unload/reload around a fine-tuning job.

        active=True:
            Captures current model state, unloads the inference model, and writes
            training_active=True to the state file so all LitServe workers free RAM.
            Returns the captured pre-training state for later restoration.

        active=False:
            Restores pre_training_state (without training_active) so workers
            auto-reload the original inference model.
        """
        with self._switch_lock:
            if active:
                saved = self._snapshot()
                self._unload_model()
                self._write_state_dict({**saved, "training_active": True})
                logger.info("Training active: inference model unloaded, workers notified")
                return saved
            else:
                restore = pre_training_state or self._snapshot()
                self._write_state_dict(restore)
                logger.info("Training finished: inference state restored for workers")
                return None

    def _read_state(self) -> Optional[dict]:
        """Read state snapshot from file."""
        try:
            if os.path.exists(self._state_path):
                with open(self._state_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read state file: {e}")
        return None

    def _state_changed(self) -> bool:
        """Check if state file has been modified since last read."""
        try:
            if not os.path.exists(self._state_path):
                return False
            
            current_mtime_ns = os.stat(self._state_path).st_mtime_ns
            changed = current_mtime_ns != self._last_state_mtime_ns
            
            if changed:
                logger.debug(f"State file changed: {self._last_state_mtime_ns} -> {current_mtime_ns}")
                self._last_state_mtime_ns = current_mtime_ns
            
            return changed
        except Exception as e:
            logger.debug(f"Error checking state file mtime: {e}")
            return False

    def _load_from_state_file(self) -> None:
        """Load model from current state file."""
        try:
            self._is_loading = True
            self._load_error = None
            self._load_start_time = datetime.now()
            
            if not self._current_engine or not self._current_model_path:
                raise ValueError("No engine or model path specified")
            
            self._model_instance = build_engine(
                engine=self._current_engine,
                model=self._current_model_path,
                adapter_model=self._current_adapter_model,
                prompt_path=self._current_prompt_path,
                use_gpu=self._use_gpu
            )
            
            self._current_device = self._get_model_device(self._model_instance)
            self._is_loading = False
            logger.info(f"Model loaded in worker: {self._current_engine} - {self._current_model_path}")
        except Exception as e:
            self._is_loading = False
            self._load_error = str(e)
            self._model_instance = None
            logger.error(f"Failed to load model from state: {e}", exc_info=True)
            raise

    # =========================
    # AUTO LOAD / HOT RELOAD
    # =========================
    def get_model(self) -> Optional[Any]:
        with self._switch_lock:
            if self._state_changed():
                state = self._read_state()
                if state:
                    # Fine-tuning in progress: yield RAM, refuse inference requests
                    if state.get("training_active"):
                        if self._model_instance is not None:
                            self._unload_model()
                        return None

                    # No model configured (e.g. immediately after training with no prior model)
                    if not state.get("engine"):
                        self._unload_model()
                        return None

                    logger.info("State file changed, reloading model in worker")
                    self._unload_model()

                    # Set metadata AFTER unloading (so it doesn't get cleared by _unload_model)
                    self._current_engine = state.get("engine")
                    self._current_model_path = state.get("model")
                    self._current_adapter_model = state.get("adapter_model")
                    self._current_prompt_path = state.get("prompt_path")
                    self._use_gpu = state.get("use_gpu", False)

                    self._load_from_state_file()
            latest_path = self.get_latest_model_path()

            if latest_path and latest_path != self._current_model_path:
                logger.info(f"🔥 New model detected: {latest_path}")

                self._unload_model()

                self._model_instance = build_engine(
                    engine="gliner",
                    model=latest_path,
                    adapter_model=None,
                    prompt_path=None,
                    use_gpu=False
                )

                self._current_model_path = latest_path
                self._current_engine = "gliner"

                logger.info("✅ Model loaded successfully")
            return self._model_instance

    # =========================
    # UNLOAD MODEL
    # =========================
    def _unload_model(self):
        try:
            if self._model_instance is not None:
                del self._model_instance
                self._model_instance = None

                gc.collect()

                if torch.cuda.is_available():
                    torch.cuda.empty_cache()

                logger.info("🧹 Model unloaded")
        except Exception as e:
            logger.warning(f"Unload error: {e}")

    # =========================
    # DISCOVER MODELS
    # =========================
    def discover_available_models(self) -> AvailableModelsResponse:
        available_models: list[AvailableModel] = []

        try:
            if not os.path.exists(RUNS_DIR):
                return AvailableModelsResponse(models=[])

            for model_dir in os.listdir(RUNS_DIR):
                full_path = os.path.join(RUNS_DIR, model_dir)

                if os.path.isdir(full_path):
                    available_models.append(
                        AvailableModel(
                            name=model_dir,
                            engine="gliner",
                            path=full_path,
                            type="gliner"
                        )
                    )

        except Exception as e:
            logger.error(f"Model discovery error: {e}")

        return AvailableModelsResponse(models=available_models)

    # =========================
    # INFO
    # =========================
    def get_model_info(self) -> ModelInfo:
        return ModelInfo(
            engine=self._current_engine or "none",
            model_path=self._current_model_path or "none",
            adapter_model=None,
            prompt_path=None,
            use_gpu=False,
            device=self._current_device,
            loaded=self._model_instance is not None,
            status="loaded" if self._model_instance else "unloaded"
        )

    def is_model_loaded(self) -> bool:
        return self._model_instance is not None

    def is_loading(self) -> bool:
        return self._is_loading


# =========================
# SINGLETON
# =========================
_model_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager