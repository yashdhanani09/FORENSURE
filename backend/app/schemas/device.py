from datetime import datetime

from typing import Literal

from pydantic import BaseModel, Field


class PartitionInfo(BaseModel):
    name: str
    device_path: str
    filesystem: str | None = None
    label: str | None = None
    uuid: str | None = None
    capacity_bytes: int = Field(ge=0)
    mount_points: list[str] = Field(default_factory=list)


class DeviceSummary(BaseModel):
    id: str = Field(description="Server-generated identifier; never a device path")
    device_path: str = Field(description="Read-only identity detail; clients must not submit this value")
    vendor: str | None = None
    model: str | None = None
    serial: str | None = None
    usb_version: str | None = None
    manufacturer: str | None = None
    device_class: str | None = None
    capacity_bytes: int = Field(ge=0)
    filesystem: str | None = None
    mount_point: str | None = None
    removable: bool
    read_only: bool
    transport: str | None = None
    device_type: str = Field(default="UNKNOWN", description="USB_STORAGE / INTERNAL_STORAGE / REMOVABLE_STORAGE / NVME / SATA / UNKNOWN")
    system_disk: bool = False
    detected_at: datetime


class DeviceDetail(DeviceSummary):
    partitions: list[PartitionInfo] = Field(default_factory=list)
    analysis_available: bool = True


class DeviceListResponse(BaseModel):
    devices: list[DeviceSummary]
    refreshed_at: datetime
    warning: str | None = None  # e.g. "Not running as Administrator — device detection limited"


class DeviceAnalysis(BaseModel):
    device_id: str
    filesystem: str | None = None
    total_bytes: int = Field(ge=0)
    used_bytes: int | None = Field(default=None, ge=0)
    free_bytes: int | None = Field(default=None, ge=0)
    file_count: int | None = Field(default=None, ge=0)
    directory_count: int | None = Field(default=None, ge=0)
    extension_counts: dict[str, int] | None = Field(default=None)
    status: str
    message: str


class FileEntry(BaseModel):
    """Metadata captured without opening or modifying a source file."""

    name: str
    path: str = Field(description="Path relative to the USB mount, never a host path")
    parent_path: str
    kind: Literal["file", "directory", "symlink", "other"]
    size_bytes: int | None = Field(default=None, ge=0)
    modified_at: datetime | None = None
    created_at: datetime | None = None
    accessed_at: datetime | None = None
    extension: str | None = None
    hidden: bool = False


class FileBrowserResponse(BaseModel):
    device_id: str
    current_path: str
    parent_path: str | None = None
    entries: list[FileEntry] = Field(default_factory=list)
    total: int = Field(ge=0)
    status: Literal["completed", "unavailable", "not_found"]
    message: str
