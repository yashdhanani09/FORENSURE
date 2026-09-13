from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base


class Operation(Base):
    __tablename__ = "operations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), index=True)
    operation_type: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    device = relationship("Device", back_populates="operations")
    evidence_items = relationship("Evidence", back_populates="operation")
    reports = relationship("Report", back_populates="operation")

