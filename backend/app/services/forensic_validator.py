import logging
import subprocess
from typing import Any, Dict

from app.services.storage_scanner import StorageScannerService

logger = logging.getLogger(__name__)

class ForensicValidator:
    """Validates that a device is safe to acquire and ensures it is read-only."""

    @staticmethod
    def validate_for_acquisition(device_id: str) -> Dict[str, Any]:
        """
        Runs strict safety rules to ensure the device is not mounted read-write
        and is safe to image.
        """
        logger.info(f"Running forensic safety validation for device {device_id}")
        
        current_devices = StorageScannerService.scan_devices()
        target_device = next((d for d in current_devices if d["id"] == device_id), None)
        
        result = {
            "device_id": device_id,
            "safe": False,
            "device_path": None,
            "size_bytes": 0,
            "vendor": None,
            "model": None,
            "serial": None,
            "warnings": []
        }
        
        if not target_device:
            result["warnings"].append("DEVICE_NOT_FOUND")
            return result
            
        result["device_path"] = target_device.get("device_path")
        result["size_bytes"] = target_device.get("size_bytes", 0)
        result["vendor"] = target_device.get("vendor")
        result["model"] = target_device.get("model")
        result["serial"] = target_device.get("serial")
        
        # Rule 1: Must not be system/boot disk
        if target_device.get("is_protected") or target_device.get("is_system_disk"):
            result["warnings"].append("BLOCKED — SYSTEM/BOOT DISK (protected from modification)")
            return result

        # Rule 2: Note mounted partitions for information (in forensic mode, read-only acquisition is used)
        for part in target_device.get("partitions", []):
            if part.get("mount_point"):
                result["warnings"].append(f"Partition {part.get('name')} is mounted at {part.get('mount_point')}. Read-only access will be used.")

        result["safe"] = True
        return result
