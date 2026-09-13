"""Server-side device lookup and persistence boundaries."""

from datetime import UTC, datetime
import logging

from sqlalchemy.orm import Session

from app.models.device import Device
from app.services.usb_detector import UsbDeviceRecord

logger = logging.getLogger(__name__)


def sync_detected_devices(db: Session, devices: list[UsbDeviceRecord]) -> None:
    """Persist audit-friendly last-seen metadata without persisting raw mounts."""
    now = datetime.now(UTC)
    active_ids = {item.id for item in devices}
    for record in devices:
        stored = db.get(Device, record.id)
        if stored is None:
            stored = Device(id=record.id)
            db.add(stored)
        stored.vendor = record.vendor
        stored.model = record.model
        stored.serial = record.serial
        stored.capacity_bytes = record.capacity_bytes
        stored.usb_version = record.usb_version
        stored.manufacturer = record.manufacturer
        stored.device_class = record.device_class
        stored.last_seen_at = now
        stored.is_connected = True
    for stored in db.query(Device).filter(Device.is_connected.is_(True)).all():
        if stored.id not in active_ids:
            stored.is_connected = False
    db.commit()

