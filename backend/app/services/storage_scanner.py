import platform
import logging

from app.services.system_disk_detector import SystemDiskDetector
from app.services.device_identity import generate_stable_id

logger = logging.getLogger(__name__)


class StorageScannerService:
    """Orchestrator for scanning physical storage devices."""

    @staticmethod
    def scan_devices() -> list[dict]:
        """Scans all connected physical storage devices and their partitions."""
        logger.info("Scanning storage devices...")

        # 1. Fetch raw physical devices from the appropriate OS adapter
        devices_raw: list[dict] = []
        os_name = platform.system()
        if os_name == "Darwin":
            from app.services.adapters.macos.diskutil_adapter import DiskutilAdapter
            devices_raw = DiskutilAdapter.get_all_disks()
        elif os_name == "Windows":
            from app.services.adapters.windows.wmic_adapter import WindowsUsbAdapter
            devices_raw = WindowsUsbAdapter.get_all_disks()
        elif os_name == "Linux":
            from app.services.adapters.linux.lsblk_adapter import LsblkAdapter
            devices_raw = LsblkAdapter.get_all_disks()
        else:
            logger.warning(
                "StorageScannerService: unsupported OS '%s', no adapter available.", os_name
            )

        # 2. Identify System/Protected Disks
        protected_paths = SystemDiskDetector.get_protected_devices()

        # 3. Normalize and enrich device data
        normalized_devices: list[dict] = []
        for d in devices_raw:

            # Enrich system disk flag
            if d["device_path"] in protected_paths:
                d["is_system_disk"] = True
                d["is_protected"] = True
            elif "is_system_disk" not in d:
                d["is_protected"] = False
                d["is_system_disk"] = False

            # Classify device type
            if not d.get("device_type"):
                if d.get("is_usb"):
                    d["device_type"] = "USB_STORAGE"
                elif d.get("is_system_disk"):
                    d["device_type"] = "INTERNAL_STORAGE"
                elif d.get("is_removable"):
                    d["device_type"] = "REMOVABLE_STORAGE"
                else:
                    d["device_type"] = "UNKNOWN"

            # Generate stable ID
            d["id"] = generate_stable_id(d)

            normalized_devices.append(d)

        return normalized_devices
