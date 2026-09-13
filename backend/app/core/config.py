from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


import sys


def _get_project_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2].parent


def _get_backend_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


BACKEND_ROOT = _get_backend_root()
PROJECT_ROOT = _get_project_root()


class Settings(BaseSettings):
    """Application configuration."""

    app_name: str = "SecureData Storage API"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./securedata.db"
    cors_origins: str = "*"
    device_refresh_seconds: int = 5
    dry_run: bool = False
    log_level: str = "INFO"
    project_root: Path = PROJECT_ROOT

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_prefix="SECUREDATA_",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

