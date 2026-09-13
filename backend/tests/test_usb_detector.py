from datetime import UTC, datetime

from app.services.usb_detector import parse_lsblk


def test_parse_lsblk_returns_all_whole_disks() -> None:
    payload = {
        "blockdevices": [
            {
                "name": "nvme0n1", "path": "/dev/nvme0n1", "type": "disk", "tran": "nvme", "rm": 0,
                "size": 512_000_000_000, "children": [{"type": "part", "mountpoints": ["/"]}],
            },
            {
                "name": "sdb", "path": "/dev/sdb", "type": "disk", "tran": "usb", "rm": 1,
                "size": 64_000_000_000, "vendor": "SanDisk", "model": "Ultra", "serial": "ABC123", "ro": 0,
                "children": [{"name": "sdb1", "path": "/dev/sdb1", "type": "part", "size": 63_999_000_000, "fstype": "vfat", "label": "FIELD", "uuid": "A1B2", "mountpoints": ["/media/user/FIELD"]}],
            },
            {"name": "sdc", "path": "/dev/sdc", "type": "disk", "tran": "usb", "rm": 0, "size": 1},
        ]
    }

    devices = parse_lsblk(payload, datetime(2026, 9, 7, tzinfo=UTC))

    # All 3 disks are now returned (NVMe + 2 USB)
    assert len(devices) == 3
    transports = {d.transport for d in devices}
    assert "nvme" in transports
    assert "usb" in transports

    # Find the main USB drive and verify its details
    usb_drive = next(d for d in devices if d.device_path == "/dev/sdb")
    assert usb_drive.filesystem == "vfat"
    assert usb_drive.mount_point == "/media/user/FIELD"
    assert usb_drive.partitions[0].uuid == "A1B2"
    assert usb_drive.id.startswith("usb_")



def test_id_is_stable_when_serial_is_available() -> None:
    node = {"blockdevices": [{"name": "sdb", "path": "/dev/sdb", "type": "disk", "tran": "usb", "rm": 1, "size": 1024, "vendor": "ACME", "model": "Key", "serial": "SER-1"}]}
    same_device_reenumerated = {"blockdevices": [{"name": "sdc", "path": "/dev/sdc", "type": "disk", "tran": "usb", "rm": 1, "size": 1024, "vendor": "ACME", "model": "Key", "serial": "SER-1"}]}

    assert parse_lsblk(node)[0].id == parse_lsblk(same_device_reenumerated)[0].id

