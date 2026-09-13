from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent


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

