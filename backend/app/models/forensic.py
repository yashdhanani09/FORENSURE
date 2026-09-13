from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.database import Base

class ForensicCase(Base):
    __tablename__ = "forensic_cases"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String(50), unique=True, index=True, nullable=False)
    case_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="CREATED")  # CREATED, ACQUIRING, ACQUIRED, ANALYZING, COMPLETED, FAILED, ABORTED
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    evidence = relationship("EvidenceItem", back_populates="case", cascade="all, delete-orphan")
    events = relationship("ChainOfCustodyEvent", back_populates="case", cascade="all, delete-orphan")
    recovered_files = relationship("RecoveredFile", back_populates="case", cascade="all, delete-orphan")

class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    
    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(String(50), unique=True, index=True, nullable=False)
    case_id = Column(Integer, ForeignKey("forensic_cases.id"), nullable=False)
    
    # Device identity
    device_id = Column(String(100), nullable=False)
    vendor = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    size_bytes = Column(Integer, nullable=False)
    
    # Acquired image metadata
    image_path = Column(String(500), nullable=True)
    image_hash = Column(String(64), nullable=True)
    filesystem = Column(String(50), nullable=True)
    partition_table = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("ForensicCase", back_populates="evidence")
    recovered_files = relationship("RecoveredFile", back_populates="evidence", cascade="all, delete-orphan")

class RecoveredFile(Base):
    __tablename__ = "recovered_files"
    
    id = Column(Integer, primary_key=True, index=True)
    recovery_id = Column(String(50), unique=True, index=True, nullable=False)
    case_id = Column(Integer, ForeignKey("forensic_cases.id"), nullable=False)
    evidence_id = Column(Integer, ForeignKey("evidence_items.id"), nullable=False)
    
    filename = Column(String(255), nullable=False)
    original_path = Column(String(1024), nullable=True)
    output_path = Column(String(1024), nullable=False)
    size_bytes = Column(Integer, nullable=False, default=0)
    
    filesystem = Column(String(50), nullable=True)
    is_deleted = Column(Boolean, default=False)
    is_allocated = Column(Boolean, default=True)
    
    recovery_method = Column(String(50), nullable=False) # e.g. "metadata", "file_carving"
    confidence = Column(String(20), nullable=False)      # HIGH, MEDIUM, LOW
    mime_type = Column(String(100), nullable=True)
    sha256 = Column(String(64), nullable=True)
    
    status = Column(String(50), default="PENDING")       # RECOVERED, PARTIAL, CORRUPTED, FAILED
    created_at = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("ForensicCase", back_populates="recovered_files")
    evidence = relationship("EvidenceItem", back_populates="recovered_files")

class ChainOfCustodyEvent(Base):
    __tablename__ = "chain_of_custody"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("forensic_cases.id"), nullable=False)
    evidence_id = Column(Integer, ForeignKey("evidence_items.id"), nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String(100), nullable=False)     # e.g. CASE_CREATED, ACQUISITION_STARTED
    actor = Column(String(100), default="SYSTEM")
    description = Column(Text, nullable=False)
    hash_value = Column(String(64), nullable=True)       # Hash of the artifact related to the event
    
    case = relationship("ForensicCase", back_populates="events")
