import os
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.schemas.recovery import (
    RecoveryScanRequest,
    RecoveryScanResponse,
    RestoreFileRequest,
    RestoreFileResponse,
    RecoveredFileRecord,
)
from app.services.storage_scanner import StorageScannerService
from app.services.recovery_service import (
    scan_device_deleted_files,
    restore_files,
    list_all_recovered_files,
)

router = APIRouter(prefix="/recovery", tags=["Recovery"])
logger = logging.getLogger(__name__)


@router.post("/scan", response_model=RecoveryScanResponse)
def scan_deleted_files_endpoint(req: RecoveryScanRequest):
    """Scans the specified storage device/drive or forensic image for deleted files."""
    if req.scan_type == "forensic_image" or (req.image_path and os.path.exists(req.image_path)):
        if not req.image_path or not os.path.exists(req.image_path):
            raise HTTPException(status_code=400, detail=f"Forensic image file not found: {req.image_path}")
        logger.info("Starting forensic image file carving on %s", req.image_path)
        files = scan_device_deleted_files({}, scan_type="forensic_image", image_path=req.image_path)
        return RecoveryScanResponse(
            device_id="forensic_image",
            device_name=f"Forensic Image ({os.path.basename(req.image_path)})",
            scan_type="forensic_image",
            scanned_at=datetime.now(timezone.utc),
            total_found=len(files),
            files=files,
        )

    devices = StorageScannerService.scan_devices()
    target = next((d for d in devices if d["id"] == req.device_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Selected storage device not found or disconnected.")

    logger.info("Starting deleted files scan on device %s (%s)", target.get("model"), req.scan_type)
    files = scan_device_deleted_files(target, scan_type=req.scan_type, image_path=req.image_path)

    return RecoveryScanResponse(
        device_id=target["id"],
        device_name=f"{target.get('vendor', '')} {target.get('model', '')}".strip() or target.get("device_path", ""),
        scan_type=req.scan_type,
        scanned_at=datetime.now(timezone.utc),
        total_found=len(files),
        files=files,
    )


@router.post("/restore", response_model=RestoreFileResponse)
def restore_files_endpoint(req: RestoreFileRequest):
    """Restores selected deleted files to a secure evidence folder and logs forensic hashes."""
    if not req.file_ids:
        raise HTTPException(status_code=400, detail="No files selected for recovery.")

    logger.info("Restoring %d file(s) for device %s", len(req.file_ids), req.device_id)
    restored = restore_files(req.file_ids, destination_folder=req.destination_folder)

    success_count = sum(1 for item in restored if item.status == "RECOVERED")
    return RestoreFileResponse(
        total_requested=len(req.file_ids),
        total_recovered=success_count,
        restored_items=restored,
    )


@router.get("/recovered", response_model=List[RecoveredFileRecord])
def get_recovered_history_endpoint():
    """Retrieves all recovered files from the forensic database."""
    return list_all_recovered_files()


@router.get("/download/{filename}")
def download_recovered_file(filename: str):
    """Downloads a recovered file from the evidence directory."""
    # Sanitize filename
    safe_name = os.path.basename(filename)
    file_path = os.path.join("evidence", "recovered", safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Recovered file not found.")

    return FileResponse(
        path=file_path,
        filename=safe_name,
        media_type="application/octet-stream",
    )
