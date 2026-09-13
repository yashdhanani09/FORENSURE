"""USB storage discovery — Linux (lsblk), macOS (diskutil), Windows (PowerShell).

Device paths are discovered server-side and never accepted from an API client.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
import hashlib
import json
import logging
import platform
import shutil
import subprocess
import time
from typing import Any

logger = logging.getLogger(__name__)


LSBLK_FIELDS = "NAME,PATH,TYPE,TRAN,RM,SIZE,VENDOR,MODEL,SERIAL,FSTYPE,LABEL,UUID,MOUNTPOINTS,RO,PKNAME"


class DeviceDetectionError(RuntimeError):
    """Raised for an environmental discovery failure, not malformed user input."""


@dataclass(frozen=True)
class PartitionRecord:
    name: str
    device_path: str
    filesystem: str | None
    label: str | None
    uuid: str | None
    capacity_bytes: int
    mount_points: list[str]


@dataclass(frozen=True)
class UsbDeviceRecord:
    id: str
    device_path: str
    vendor: str | None
    model: str | None
    serial: str | None
    usb_version: str | None
    manufacturer: str | None
    device_class: str | None
    capacity_bytes: int
    filesystem: str | None
    mount_point: str | None
    removable: bool
    read_only: bool
    transport: str | None
    detected_at: datetime
    partitions: list[PartitionRecord] = field(default_factory=list)
    system_disk: bool = False
    device_type: str = "UNKNOWN"

    @property
    def identity_fingerprint(self) -> str:
        return "|".join(
            [self.vendor or "", self.model or "", self.serial or "", str(self.capacity_bytes)]
        )


def _text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _mount_points(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item]
    if value:
        return [str(value)]
    return []


def _make_id(node: dict[str, Any]) -> str:
    # A serial-led fingerprint remains stable across normal re-enumeration. A
    # kernel name is only a collision fallback when the device exposes no serial.
    identity = "|".join(
        filter(
            None,
            [
                _text(node.get("vendor")),
                _text(node.get("model")),
                _text(node.get("serial")),
                str(node.get("size") or 0),
                _text(node.get("name")) if not _text(node.get("serial")) else None,
            ],
        )
    )
    return f"usb_{hashlib.sha256(identity.encode()).hexdigest()[:24]}"


def _is_system_disk(node: dict[str, Any]) -> bool:
    """A belt-and-braces signal for future destructive validation.

    USB removable disks should never host `/`, but retaining this marker makes a
    surprising mount state visible to the UI and later sanitization policy.
    """
    for item in [node, *node.get("children", [])]:
        if "/" in _mount_points(item.get("mountpoints")):
            return True
    return False


def _get_udevadm_info(device_path: str) -> dict[str, str]:
    if not device_path:
        return {}
    try:
        if not shutil.which("udevadm"):
            return {}
        result = subprocess.run(["udevadm", "info", "--query=property", "--name=" + device_path], capture_output=True, text=True, timeout=2)
        props = {}
        for line in result.stdout.splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                props[k] = v
        return props
    except Exception:
        return {}


def parse_lsblk(payload: dict[str, Any], detected_at: datetime | None = None) -> list[UsbDeviceRecord]:
    """Parse `lsblk --json` output into all whole-disk block devices."""
    timestamp = detected_at or datetime.now(UTC)
    devices: list[UsbDeviceRecord] = []
    for node in payload.get("blockdevices", []):
        if node.get("type") != "disk":
            continue
        # Include ALL disks regardless of transport or removable flag

        partitions: list[PartitionRecord] = []
        for child in node.get("children", []):
            if child.get("type") != "part":
                continue
            partitions.append(
                PartitionRecord(
                    name=str(child.get("name") or "unknown"),
                    device_path=str(child.get("path") or ""),
                    filesystem=_text(child.get("fstype")),
                    label=_text(child.get("label")),
                    uuid=_text(child.get("uuid")),
                    capacity_bytes=int(child.get("size") or 0),
                    mount_points=_mount_points(child.get("mountpoints")),
                )
            )

        filesystem = _text(node.get("fstype")) or next(
            (partition.filesystem for partition in partitions if partition.filesystem), None
        )
        mount_points = _mount_points(node.get("mountpoints"))
        if not mount_points:
            mount_points = [mount for partition in partitions for mount in partition.mount_points]
        
        path = str(node.get("path") or "")
        udev_props = _get_udevadm_info(path)
        usb_version = _text(udev_props.get("ID_USB_INTERFACES"))  # Or parse further
        if usb_version and ":" in usb_version:
            # Very basic extraction if needed, though ID_USB_INTERFACES is usually classes.
            pass
        usb_version = _text(udev_props.get("ID_REVISION") or udev_props.get("ID_USB_REVISION"))
        manufacturer = _text(udev_props.get("ID_VENDOR_FROM_DATABASE") or udev_props.get("ID_VENDOR"))
        device_class = _text(udev_props.get("ID_USB_CLASS_FROM_DATABASE") or "Mass Storage")

        devices.append(
            UsbDeviceRecord(
                id=_make_id(node),
                device_path=path,
                vendor=_text(node.get("vendor")),
                model=_text(node.get("model")),
                serial=_text(node.get("serial")),
                usb_version=usb_version,
                manufacturer=manufacturer,
                device_class=device_class,
                capacity_bytes=int(node.get("size") or 0),
                filesystem=filesystem,
                mount_point=mount_points[0] if mount_points else None,
                removable=bool(node.get("rm")),
                read_only=bool(node.get("ro")),
                transport=_text(node.get("tran")),
                detected_at=timestamp,
                partitions=partitions,
                system_disk=_is_system_disk(node),
            )
        )
    return devices


from app.services.storage_scanner import StorageScannerService


def _map_scanner_devices(
    raw_devices: list[dict], detected_at: datetime | None, source: str
) -> list[UsbDeviceRecord]:
    """Shared helper: convert StorageScannerService dicts to UsbDeviceRecord list."""
    devices: list[UsbDeviceRecord] = []
    for d in raw_devices:
        partitions: list[PartitionRecord] = []
        for p in d.get("partitions", []):
            raw_path: str = p.get("partition_path", "")
            # On Windows the path looks like \\.\PHYSICALDRIVE1p1; use only the suffix as name
            part_name = raw_path.replace("\\\\", "").replace("\\.", "").replace("\\", "/").split("/")[-1]
            partitions.append(
                PartitionRecord(
                    name=part_name or raw_path,
                    device_path=raw_path,
                    filesystem=p.get("partition_filesystem"),
                    label=p.get("partition_label"),
                    uuid=p.get("partition_uuid"),
                    capacity_bytes=int(p.get("partition_size") or 0),
                    mount_points=[p["mount_point"]] if p.get("mount_point") else [],
                )
            )

        first_mount = next(
            (mp for part in partitions for mp in part.mount_points), None
        )
        devices.append(
            UsbDeviceRecord(
                id=d["id"],
                device_path=d["device_path"],
                vendor=d.get("vendor"),
                model=d.get("model"),
                serial=d.get("serial"),
                usb_version=None,
                manufacturer=None,
                device_class="Mass Storage",
                capacity_bytes=int(d.get("size_bytes") or 0),
                filesystem=None,
                mount_point=first_mount,
                removable=bool(d.get("is_removable", False)),
                read_only=bool(d.get("is_read_only", False)),
                transport=d.get("bus"),
                detected_at=detected_at or datetime.now(UTC),
                partitions=partitions,
                system_disk=bool(d.get("is_system_disk", False)),
                device_type=str(d.get("device_type") or "UNKNOWN"),
            )
        )
    return devices


def parse_native_mac(detected_at: datetime | None = None) -> list[UsbDeviceRecord]:
    """Execute StorageScannerService on macOS."""
    try:
        raw_devices = StorageScannerService.scan_devices()
        return _map_scanner_devices(raw_devices, detected_at, "macOS")
    except Exception as exc:
        logger.error("StorageScannerService macOS failed: %s", exc)
        return []


def parse_native_windows(detected_at: datetime | None = None) -> list[UsbDeviceRecord]:
    """Execute StorageScannerService on Windows."""
    try:
        raw_devices = StorageScannerService.scan_devices()
        return _map_scanner_devices(raw_devices, detected_at, "Windows")
    except Exception as exc:
        logger.error("StorageScannerService Windows failed: %s", exc)
        return []




class UsbDetector:
    def __init__(self) -> None:
        self._cache: list[UsbDeviceRecord] | None = None
        self._cache_time: float = 0.0
        self._CACHE_TTL: float = 30.0

    def is_available(self) -> bool:
        system = platform.system()
        if system == "Darwin" and shutil.which("diskutil"):
            return True
        if system == "Linux" and shutil.which("lsblk") is not None:
            return True
        if system == "Windows":
            return shutil.which("powershell") is not None
        return False

    def list_devices(self, force_refresh: bool = False) -> list[UsbDeviceRecord]:
        now = time.time()
        if not force_refresh and self._cache is not None and (now - self._cache_time < self._CACHE_TTL):
            return self._cache

        if not self.is_available():
            raise DeviceDetectionError(
                "USB detection requires Linux (lsblk), macOS (diskutil), or Windows (PowerShell)."
            )

        system = platform.system()

        if system == "Darwin":
            devices = parse_native_mac()
        elif system == "Windows":
            devices = parse_native_windows()
        else:
            # Linux path: run lsblk directly
            try:
                result = subprocess.run(
                    ["lsblk", "--json", "--bytes", "--output", LSBLK_FIELDS],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=8,
                )
                devices = parse_lsblk(json.loads(result.stdout))
            except (subprocess.SubprocessError, json.JSONDecodeError) as exc:
                logger.exception("USB device detection failed")
                raise DeviceDetectionError("The system could not query USB storage devices.") from exc

        self._cache = devices
        self._cache_time = time.time()
        return devices

    def get_device(self, device_id: str) -> UsbDeviceRecord | None:
        now = time.time()
        if self._cache is not None and (now - self._cache_time < self._CACHE_TTL):
            found = next((device for device in self._cache if device.id == device_id), None)
            if found is not None:
                return found
        return next((device for device in self.list_devices() if device.id == device_id), None)


usb_detector = UsbDetector()
