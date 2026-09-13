from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class CaseCreateRequest(BaseModel):
    case_name: str
    description: Optional[str] = None
    device_id: str

class CaseResponse(BaseModel):
    case_id: str
    case_name: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

class EvidenceResponse(BaseModel):
    evidence_id: str
    device_id: str
    vendor: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    size_bytes: int
    image_path: Optional[str] = None
    image_hash: Optional[str] = None
    filesystem: Optional[str] = None
    partition_table: Optional[str] = None

class RecoveredFileResponse(BaseModel):
    recovery_id: str
    filename: str
    original_path: Optional[str] = None
    size_bytes: int
    filesystem: Optional[str] = None
    is_deleted: bool
    is_allocated: bool
    recovery_method: str
    confidence: str
    mime_type: Optional[str] = None
    sha256: Optional[str] = None
    status: str
    created_at: datetime

class ChainOfCustodyEventResponse(BaseModel):
    timestamp: datetime
    event_type: str
    actor: str
    description: str
    hash_value: Optional[str] = None

class ForensicCaseDetailResponse(BaseModel):
    case: CaseResponse
    evidence: List[EvidenceResponse]
    events: List[ChainOfCustodyEventResponse]

class RecoverRequest(BaseModel):
    file_paths: List[str]
    method: str = Field(default="metadata") # metadata or carving

class RecoverResponse(BaseModel):
    message: str
    job_id: str

class ForensicJobProgress(BaseModel):
    job_id: str
    case_id: str
    type: str # acquisition, analysis, recovery
    status: str
    progress_percent: float
    bytes_processed: int
    total_bytes: int
    speed_bytes_per_second: float
    estimated_seconds_remaining: int
    stage: str
    error_message: Optional[str] = None
