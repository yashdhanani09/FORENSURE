from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


import sys
from pathlib import Path


def _engine_url() -> str:
    url = get_settings().database_url
    if getattr(sys, "frozen", False):
        # When packaged as a standalone binary, store the DB in the executable's directory
        app_dir = Path(sys.executable).resolve().parent
        db_path = app_dir / "securedata.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path.as_posix()}"
    elif url == "sqlite:///./securedata.db":
        # Resolve the development default against backend/ instead of process CWD.
        db_path = get_settings().project_root / "backend" / "securedata.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path.as_posix()}"
    elif url.startswith("sqlite:///"):
        # Auto-create parent directory for any custom sqlite database path
        raw_path = url.replace("sqlite:///", "")
        custom_path = Path(raw_path)
        if custom_path.parent:
            custom_path.parent.mkdir(parents=True, exist_ok=True)
    return url


connect_args = {"check_same_thread": False} if _engine_url().startswith("sqlite") else {}
engine = create_engine(_engine_url(), connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database() -> None:
    # Import models before creating metadata, avoiding migration magic at startup.
    from app.models import device, evidence, operation, report  # noqa: F401

    Base.metadata.create_all(bind=engine)

