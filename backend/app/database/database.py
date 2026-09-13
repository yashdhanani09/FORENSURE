from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


def _engine_url() -> str:
    url = get_settings().database_url
    # Resolve the development default against backend/ instead of process CWD.
    if url == "sqlite:///./securedata.db":
        return f"sqlite:///{get_settings().project_root / 'backend' / 'securedata.db'}"
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

