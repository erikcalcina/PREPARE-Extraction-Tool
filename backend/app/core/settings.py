import secrets
import warnings
from pathlib import Path
from typing import List, Union

from typing_extensions import Self
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator, model_validator

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent

# ======================================================
# Settings configuration
# ======================================================

class Settings(BaseSettings):
    # Database settings
    DATABASE_URL: Union[str, None] = None
    ELASTICSEARCH_URL: Union[str, None] = None

    # App settings
    SERVICE_NAME: str = "PREPARE USAGI"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    API_V1_STR: str = "/api/v1"

    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        if isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        if value == "changethis":
            message = (
                f'The value of {var_name} is "changethis", '
                "for security, please change it, at least for deployments."
            )
            if self.ENVIRONMENT == "local":
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
        return self


    # ======================================================
    # Model settings
    # ======================================================

    EMBEDDING_MODEL: Union[str, None] = None

    # ======================================================
    # Environment setting
    # ======================================================

    model_config = SettingsConfigDict(env_file=str(PROJECT_ROOT / ".env"), env_file_encoding="utf-8", extra="ignore")

settings = Settings()
