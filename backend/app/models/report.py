from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    operation_id: Mapped[str] = mapped_column(ForeignKey("operations.id"), index=True)
    report_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32))
    json_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    operation = relationship("Operation", back_populates="reports")

