import logging
from typing import Any

from app.services.storage_scanner import StorageScannerService

logger = logging.getLogger(__name__)

class DeviceSafetyValidator:
    """Validates that a device is safe to sanitize — works on all device types."""

    @staticmethod
    def validate_for_sanitization(device_id: str) -> dict[str, Any]:
        """
        Independently rediscovers the device and runs strict safety rules.
        Supports USB drives, SATA SSDs/HDDs, NVMe drives, SD cards, etc.
        """
        logger.info(f"Running safety validation for device {device_id}")

        current_devices = StorageScannerService.scan_devices()
        target_device = next((d for d in current_devices if d["id"] == device_id), None)

        result = {
            "device_id": device_id,
            "safe": False,
            "device_type": None,
            "vendor": None,
            "model": None,
            "serial": None,
            "is_system_disk": False,
            "is_boot_disk": False,
            "is_mounted": False,
            "is_physical_device": False,
            "warnings": []
        }

        if not target_device:
            result["warnings"].append("Device not found or disconnected.")
            return result

        result["device_type"] = target_device.get("device_type")
        result["vendor"] = target_device.get("vendor")
        result["model"] = target_device.get("model")
        result["serial"] = target_device.get("serial")
        result["is_system_disk"] = target_device.get("is_system_disk", False)
        result["is_boot_disk"] = target_device.get("is_system_disk", False)
        result["is_physical_device"] = True

        # Rule 1: Must not be a protected/system/boot disk — blocks C: drive, root FS
        if target_device.get("is_protected") or target_device.get("is_system_disk"):
            result["warnings"].append("BLOCKED — SYSTEM/BOOT DISK (protected from modifications)")
            return result

        # Rule 2: Locate a mount point (needed for file-level sanitization on the filesystem)
        is_mounted = False
        mount_point = None
        for part in target_device.get("partitions", []):
            mp = part.get("mount_point")
            if mp:
                mount_point = mp
                is_mounted = True
                break

        result["is_mounted"] = is_mounted
        result["mount_point"] = mount_point

        if not is_mounted:
            result["warnings"].append("BLOCKED — DEVICE NOT MOUNTED (insert and wait for OS to mount it)")
            result["safe"] = False
            return result

        result["safe"] = True
        return result
