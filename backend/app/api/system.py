import platform

from fastapi import APIRouter

from app.schemas.system import SystemStatus
from app.services.usb_detector import usb_detector

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/status", response_model=SystemStatus)
def get_system_status() -> SystemStatus:
    available = usb_detector.is_available()
    if available:
        message = f"{platform.system()} USB detection is ready. Real block devices are listed."
    else:
        message = f"USB detection requires Linux with lsblk, macOS with diskutil, or Windows with PowerShell. Current host: {platform.system()}."
    return SystemStatus(
        platform_supported=platform.system() in ("Linux", "Darwin", "Windows"),
        device_detection_available=available,
        message=message,
    )

