from pydantic import BaseModel

class DeletedFileRecord(BaseModel):
    inode: str
    filename: str
    size_bytes: int | None = None
    recoverable: bool

class ForensicScanResponse(BaseModel):
    device_id: str
    deleted_files: list[DeletedFileRecord]
    status: str
    message: str
