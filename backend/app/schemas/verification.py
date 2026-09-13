from pydantic import BaseModel

class OffsetVerification(BaseModel):
    offset_bytes: int
    passed: bool

class VerificationResult(BaseModel):
    device_id: str
    status: str
    message: str
    is_zeroed: bool
    sampled_offsets: list[OffsetVerification]
