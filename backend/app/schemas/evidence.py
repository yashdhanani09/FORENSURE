from datetime import datetime
from pydantic import BaseModel, Field

class EvidenceRecord(BaseModel):
    id: str
    case_id: str
    path: str
    sha256: str | None = None
    created_at: datetime
    operation_id: str

class EvidenceListResponse(BaseModel):
    device_id: str
    evidence_records: list[EvidenceRecord]
