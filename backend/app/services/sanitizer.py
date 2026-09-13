import logging
import platform
import subprocess
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.schemas.evidence import EvidenceRecord
from app.services.filesystem_analyzer import FileBrowserError
from app.services.hasher import _record_evidence
from app.services.usb_detector import UsbDeviceRecord

logger = logging.getLogger(__name__)

def sanitize_device(db: Session, record: UsbDeviceRecord, case_id: str = "CASE-DEFAULT") -> EvidenceRecord:
    """Wipes the device using native OS commands (zero-fill)."""

    if not record.device_path:
        raise FileBrowserError("Device path unavailable for sanitization.")

    logger.warning("Initiating destructive sanitization on %s", record.device_path)

    try:
        if platform.system() == "Darwin":
            # Unmount the disk first
            subprocess.run(["diskutil", "unmountDisk", record.device_path], check=True, capture_output=True)
            # secureErase 0 writes zeroes to the entire disk. 
            # Note: This will destroy all partitions and data!
            subprocess.run(
                ["diskutil", "secureErase", "0", record.device_path],
                check=True,
                capture_output=True,
                text=True
            )
        elif platform.system() == "Windows":
            import re
            m = re.search(r'PHYSICALDRIVE(\d+)', record.device_path, re.IGNORECASE)
            if not m:
                raise FileBrowserError(f"Cannot identify disk number for Windows device {record.device_path}")
            disk_num = m.group(1)
            if record.system_disk:
                raise FileBrowserError("Cannot sanitize a system disk.")
            ps_cmd = f"Clear-Disk -Number {disk_num} -RemoveData -Confirm:$false -ErrorAction Stop"
            subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd], check=True, capture_output=True, text=True)
        else:
            # Fallback for Linux (dd with urandom/zero)
            subprocess.run(["umount", f"{record.device_path}*"], capture_output=True)
            subprocess.run(
                ["dd", "if=/dev/zero", f"of={record.device_path}", "bs=4M", "status=progress"],
                check=True,
                capture_output=True
            )
            
        # Log to evidence that a wipe was completed
        return _record_evidence(db, record.id, "sanitize_wipe_completed", "verified_zeros", case_id)

    except subprocess.CalledProcessError as exc:
        logger.error("Sanitization failed: %s", exc.stderr if hasattr(exc, 'stderr') else str(exc))
        raise FileBrowserError("Failed to sanitize device. Ensure you have root (sudo) privileges.")
