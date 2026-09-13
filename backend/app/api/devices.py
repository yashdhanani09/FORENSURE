import logging
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.admin_check import is_admin
from app.database.database import get_db
from app.schemas.device import DeviceAnalysis, DeviceDetail, DeviceListResponse, DeviceSummary, FileBrowserResponse, PartitionInfo
from app.schemas.evidence import EvidenceRecord, EvidenceListResponse
from app.schemas.forensics import ForensicScanResponse
from app.schemas.verification import VerificationResult
from app.services.device_manager import sync_detected_devices
from app.services.filesystem_analyzer import FileBrowserError, analyze_device, browse_files, preview_file
from app.services.hasher import hash_file, list_evidence
from app.services.reporter import generate_json_report, generate_pdf_report
from app.services.sanitizer import sanitize_device
from app.services.verifier import verify_wipe
from app.services.usb_detector import DeviceDetectionError, UsbDeviceRecord, usb_detector

router = APIRouter(prefix="/devices", tags=["USB devices"])
logger = logging.getLogger(__name__)


def _device_type(record: UsbDeviceRecord) -> str:
    """Derive a human-readable device type label from transport and flags."""
    if getattr(record, "device_type", None) and record.device_type != "UNKNOWN":
        return record.device_type
    tran = (record.transport or "").lower()
    if tran == "usb":
        return "USB_STORAGE"
    if tran in ("nvme", "sata", "ata", "scsi"):
        return "INTERNAL_STORAGE"
    if tran == "mmc":
        return "SD_CARD"
    if tran == "scsi":
        return "SCSI"
    if record.system_disk:
        return "INTERNAL_STORAGE"
    if record.removable:
        return "REMOVABLE_STORAGE"
    return "INTERNAL_STORAGE"


def _summary(record: UsbDeviceRecord) -> DeviceSummary:
    return DeviceSummary(
        id=record.id,
        device_path=record.device_path,
        vendor=record.vendor,
        model=record.model,
        serial=record.serial,
        capacity_bytes=record.capacity_bytes,
        filesystem=record.filesystem,
        mount_point=record.mount_point,
        removable=record.removable,
        read_only=record.read_only,
        transport=record.transport,
        usb_version=record.usb_version,
        manufacturer=record.manufacturer,
        device_class=record.device_class,
        device_type=_device_type(record),
        system_disk=record.system_disk,
        detected_at=record.detected_at,
    )


def _detail(record: UsbDeviceRecord) -> DeviceDetail:
    return DeviceDetail(
        **_summary(record).model_dump(),
        partitions=[
            PartitionInfo(
                name=partition.name,
                device_path=partition.device_path,
                filesystem=partition.filesystem,
                label=partition.label,
                uuid=partition.uuid,
                capacity_bytes=partition.capacity_bytes,
                mount_points=partition.mount_points,
            )
            for partition in record.partitions
        ],
    )


def _devices_or_error(force_refresh: bool = False) -> list[UsbDeviceRecord]:
    try:
        try:
            return usb_detector.list_devices(force_refresh=force_refresh)
        except TypeError:
            return usb_detector.list_devices()
    except DeviceDetectionError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


def _find_current_device(device_id: str) -> UsbDeviceRecord:
    # Use cached device lookup first; refreshes hardware if expired or not found
    record = usb_detector.get_device(device_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The USB device is no longer connected or is not eligible for this application.",
        )
    return record


@router.get("", response_model=DeviceListResponse)
def list_devices(
    refresh: bool = Query(default=False, description="Force fresh hardware re-enumeration"),
    db: Session = Depends(get_db),
) -> DeviceListResponse:
    records = _devices_or_error(force_refresh=refresh)
    sync_detected_devices(db, records)
    logger.info("usb_devices_listed count=%s refreshed=%s", len(records), refresh)
    # Inform the frontend when we're running without admin rights so it can
    # show an actionable banner instead of a confusing empty device list.
    warning: str | None = None
    if not is_admin():
        import platform
        if platform.system() == "Windows":
            warning = (
                "Device detection is limited — the backend is not running as Administrator. "
                "Please close this terminal and reopen it with 'Run as Administrator', "
                "then restart the backend."
            )
    return DeviceListResponse(
        devices=[_summary(record) for record in records],
        refreshed_at=datetime.now(UTC),
        warning=warning,
    )


@router.get("/{device_id}", response_model=DeviceDetail)
def get_device(device_id: str) -> DeviceDetail:
    return _detail(_find_current_device(device_id))


@router.post("/{device_id}/analyze", response_model=DeviceAnalysis)
def analyze_usb_device(device_id: str) -> DeviceAnalysis:
    """Run the Phase 1 read-only storage analysis for a current server-side device."""
    record = _find_current_device(device_id)
    logger.info("filesystem_analysis_started device_id=%s", record.id)
    result = analyze_device(record)
    logger.info("filesystem_analysis_finished device_id=%s status=%s", record.id, result.status)
    return result


@router.get("/{device_id}/files", response_model=FileBrowserResponse)
def list_device_files(
    device_id: str,
    path: str = Query(default="", max_length=1024, description="USB-relative folder path"),
    search: str = Query(default="", max_length=256, description="Case-insensitive filename filter in the current folder"),
    kind: Literal["all", "file", "directory"] = Query(default="all"),
    sort_by: Literal["name", "size", "modified", "type"] = Query(default="name"),
    sort_order: Literal["asc", "desc"] = Query(default="asc"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
) -> FileBrowserResponse:
    """List metadata under a mounted USB directory without opening its files."""
    record = _find_current_device(device_id)
    try:
        result = browse_files(record, path=path, search=search, kind=kind, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
    except FileBrowserError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    logger.info("usb_folder_listed device_id=%s path=%s count=%s status=%s", record.id, result.current_path or "/", result.total, result.status)
    return result


@router.get("/{device_id}/files/content")
def get_file_content(
    device_id: str,
    path: str = Query(..., max_length=1024, description="USB-relative file path"),
) -> dict[str, str]:
    """Read a safe, bounded preview of a file's contents."""
    record = _find_current_device(device_id)
    try:
        return preview_file(record, path)
    except FileBrowserError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{device_id}/files/hash", response_model=EvidenceRecord)
def hash_device_file(
    device_id: str,
    path: str = Query(..., max_length=1024, description="USB-relative file path"),
    db: Session = Depends(get_db)
) -> EvidenceRecord:
    """Calculate the SHA-256 hash for a file and record it as evidence."""
    record = _find_current_device(device_id)
    try:
        result = hash_file(db, record, path)
        logger.info("file_hashed device_id=%s path=%s sha256=%s", record.id, path, result.sha256)
        return result
    except FileBrowserError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{device_id}/evidence", response_model=EvidenceListResponse)
def get_device_evidence(
    device_id: str,
    db: Session = Depends(get_db)
) -> EvidenceListResponse:
    """List all immutable evidence records tied to this device's operations."""
    _find_current_device(device_id)  # Validate device exists/eligible
    records = list_evidence(db, device_id)
    return EvidenceListResponse(device_id=device_id, evidence_records=records)





@router.post("/{device_id}/verify", response_model=VerificationResult)
async def verify_device_wipe(device_id: str) -> VerificationResult:
    """Verify that a device has been successfully wiped by sampling the block device."""
    record = _find_current_device(device_id)
    try:
        return await verify_wipe(record)
    except FileBrowserError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{device_id}/sanitize", response_model=EvidenceRecord)
def sanitize_usb_device(
    device_id: str,
    db: Session = Depends(get_db)
) -> EvidenceRecord:
    """Destructively wipe the device and zero-fill its blocks."""
    record = _find_current_device(device_id)
    try:
        return sanitize_device(db, record)
    except FileBrowserError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{device_id}/report/json")
def get_device_report_json(device_id: str, db: Session = Depends(get_db)):
    """Generate a comprehensive JSON audit report for the device."""
    record = _find_current_device(device_id)
    detail = _detail(record)
    try:
        return generate_json_report(detail, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{device_id}/report/pdf")
def get_device_report_pdf(device_id: str, db: Session = Depends(get_db)):
    """Generate a comprehensive PDF audit report for the device."""
    record = _find_current_device(device_id)
    detail = _detail(record)
    try:
        pdf_buffer = generate_pdf_report(detail, db)
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=audit_report_{device_id}.pdf"}
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


