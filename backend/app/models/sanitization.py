from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base


class SanitizationJob(Base):
    __tablename__ = "sanitization_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=lambda: f"SAN-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}")
    
    device_id: Mapped[str] = mapped_column(String(64), ForeignKey("devices.id"))
    device_path: Mapped[str] = mapped_column(String(256))
    target_file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    vendor: Mapped[str | None] = mapped_column(String(128))
    model: Mapped[str | None] = mapped_column(String(128))
    serial_number: Mapped[str | None] = mapped_column(String(256))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)

    method: Mapped[str] = mapped_column(String(64))
    pattern: Mapped[str] = mapped_column(String(64))
    passes: Mapped[int] = mapped_column(Integer, default=1)

    status: Mapped[str] = mapped_column(String(64), default="PENDING")

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    bytes_processed: Mapped[int] = mapped_column(Integer, default=0)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0)

    verification_method: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verification_scope: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verification_result: Mapped[str | None] = mapped_column(String(64), nullable=True)

    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    certificate_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    certificate_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Relationships
    device = relationship("Device")
    events = relationship("SanitizationEvent", back_populates="job", cascade="all, delete-orphan")


class SanitizationEvent(Base):
    __tablename__ = "sanitization_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("sanitization_jobs.id"))
    device_id: Mapped[str] = mapped_column(String(64))
    event_type: Mapped[str] = mapped_column(String(64))
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(32), default="INFO")
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    job = relationship("SanitizationJob", back_populates="events")
