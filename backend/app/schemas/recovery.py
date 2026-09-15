from datetime import datetime
from typing import Literal, Optional, List
from pydantic import BaseModel, Field


class DeletedFileItem(BaseModel):
    id: str
    filename: str
    original_path: str
    source_path: str
    size_bytes: int
    extension: str
    category: str  # Document, Image, Audio, Video, Archive, Other
    deleted_at: Optional[datetime] = None
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = "HIGH"
    confidence_score: int = Field(default=90, description="Evidence quality score 0-100")
    validation_details: Optional[str] = Field(default=None, description="Technical validation analysis details")
    offset_bytes: Optional[int] = Field(default=None, description="Byte offset in storage/image")
    recovery_method: str = "ntfs_metadata"  # ntfs_metadata, file_carving, tsk
    recoverable: bool = True


class RecoveryScanRequest(BaseModel):
    device_id: str
    scan_type: Literal["auto", "unified", "quick", "deep", "carving", "forensic_image"] = "auto"
    target_path: Optional[str] = None
    image_path: Optional[str] = None


class RecoveryScanResponse(BaseModel):
    device_id: str
    device_name: str
    scan_type: str
    scanned_at: datetime
    total_found: int
    files: List[DeletedFileItem]
    device_profile: Optional[dict] = None
    acquisition_hash: Optional[str] = None


class ForensicReportResponse(BaseModel):
    report_id: str
    generated_at: datetime
    case_id: str
    case_name: str
    device_id: str
    device_name: str
    device_profile: dict
    acquisition_hash: str
    total_discovered: int
    total_recovered: int
    discovered_files: List[DeletedFileItem]
    recovered_files: List[dict]
    chain_of_custody: List[dict]
    executive_summary: str


class RestoreFileRequest(BaseModel):
    device_id: str
    file_ids: List[str]
    destination_folder: Optional[str] = None


class RestoredItem(BaseModel):
    file_id: str
    filename: str
    output_path: str
    size_bytes: int
    sha256: str
    status: Literal["RECOVERED", "FAILED"]
    error: Optional[str] = None


class RestoreFileResponse(BaseModel):
    total_requested: int
    total_recovered: int
    restored_items: List[RestoredItem]


class RecoveredFileRecord(BaseModel):
    recovery_id: str
    filename: str
    output_path: str
    size_bytes: int
    sha256: Optional[str] = None
    confidence: str
    recovery_method: str
    created_at: datetime
