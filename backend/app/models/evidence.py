from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    operation_id: Mapped[str] = mapped_column(ForeignKey("operations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(64), index=True)
    path: Mapped[str] = mapped_column(String(512))
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    operation = relationship("Operation", back_populates="evidence_items")

