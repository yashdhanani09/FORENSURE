from datetime import datetime
from pydantic import BaseModel, Field

class ValidationRequest(BaseModel):
    device_id: str

class ValidationResponse(BaseModel):
    device_id: str
    safe: bool
    device_type: str | None = None
    is_system_disk: bool = False
    is_boot_disk: bool = False
    is_mounted: bool = False
    is_physical_device: bool = False
    warnings: list[str] = Field(default_factory=list)

class SanitizationStartRequest(BaseModel):
    device_id: str
    target_file_path: str
    method: str = Field(default="overwrite")
    pattern: str = Field(default="zero")
    confirmation: bool

class SanitizationStartResponse(BaseModel):
    job_id: str
    status: str

class SanitizationJobProgress(BaseModel):
    job_id: str
    device_id: str
    status: str
    progress_percent: float
    bytes_processed: int
    total_bytes: int
    speed_bytes_per_second: int
    estimated_seconds_remaining: int
    current_stage: str
    error_message: str | None = None

class SanitizationEventSchema(BaseModel):
    timestamp: datetime
    event_type: str
    message: str
    severity: str

class SanitizationJobHistory(BaseModel):
    job_id: str
    device_id: str
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    method: str
    pattern: str
    target_file_path: str | None = None
    verification_result: str | None = None
    certificate_hash: str | None = None
    events: list[SanitizationEventSchema] = Field(default_factory=list)
