from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    vendor: Mapped[str | None] = mapped_column(String(128), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    serial: Mapped[str | None] = mapped_column(String(256), nullable=True)
    capacity_bytes: Mapped[int] = mapped_column(Integer, default=0)
    usb_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(128), nullable=True)
    device_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=True)
    operations = relationship("Operation", back_populates="device")

