import logging
from pathlib import Path

from app.core.config import get_settings


def configure_logging() -> None:
    settings = get_settings()
    log_dir = settings.project_root / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(Path(log_dir) / "securedata-api.log"),
        ],
        force=True,
    )

