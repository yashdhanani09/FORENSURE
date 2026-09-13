import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.services.device_safety import DeviceSafetyValidator
from app.services.forensic_validator import ForensicValidator
from app.services.storage_scanner import StorageScannerService


@pytest.fixture
def mock_storage_devices(monkeypatch):
    devices = [
        {
            "id": "dev_nvme_ssd",
            "device_path": r"\\.\PHYSICALDRIVE1",
            "kernel_name": "PHYSICALDRIVE1",
            "vendor": "Samsung",
            "model": "SSD 980 PRO 1TB",
            "serial": "S5GXNF0R123456",
            "size_bytes": 1_000_204_886_016,
            "bus": "nvme",
            "device_type": "NVME",
            "is_usb": False,
            "is_removable": False,
            "is_system_disk": False,
            "is_protected": False,
            "is_read_only": False,
            "partitions": [
                {
                    "partition_path": r"\\.\PHYSICALDRIVE1p1",
                    "partition_number": "1",
                    "partition_size": 1_000_204_886_016,
                    "partition_filesystem": "NTFS",
                    "partition_uuid": "UUID-1111",
                    "partition_label": "DataDrive",
                    "mount_point": "D:\\",
                }
            ],
        },
        {
            "id": "dev_sata_ssd",
            "device_path": r"\\.\PHYSICALDRIVE2",
            "kernel_name": "PHYSICALDRIVE2",
            "vendor": "Crucial",
            "model": "MX500",
            "serial": "CT1000MX500",
            "size_bytes": 500_000_000_000,
            "bus": "sata",
            "device_type": "SATA",
            "is_usb": False,
            "is_removable": False,
            "is_system_disk": False,
            "is_protected": False,
            "is_read_only": False,
            "partitions": [
                {
                    "partition_path": r"\\.\PHYSICALDRIVE2p1",
                    "partition_number": "1",
                    "partition_size": 500_000_000_000,
                    "partition_filesystem": "NTFS",
                    "partition_uuid": "UUID-2222",
                    "partition_label": "Storage",
                    "mount_point": "E:\\",
                }
            ],
        },
        {
            "id": "dev_system_disk",
            "device_path": r"\\.\PHYSICALDRIVE0",
            "kernel_name": "PHYSICALDRIVE0",
            "vendor": "KIOXIA",
            "model": "KBG40ZNS512G",
            "serial": "SYS-BOOT-999",
            "size_bytes": 512_000_000_000,
            "bus": "nvme",
            "device_type": "INTERNAL_STORAGE",
            "is_usb": False,
            "is_removable": False,
            "is_system_disk": True,
            "is_protected": True,
            "is_read_only": False,
            "partitions": [
                {
                    "partition_path": r"\\.\PHYSICALDRIVE0p1",
                    "partition_number": "1",
                    "partition_size": 512_000_000_000,
                    "partition_filesystem": "NTFS",
                    "partition_uuid": "UUID-0000",
                    "partition_label": "Windows",
                    "mount_point": "C:\\",
                }
            ],
        },
    ]
    monkeypatch.setattr(StorageScannerService, "scan_devices", staticmethod(lambda: devices))
    return devices


def test_device_safety_validator_allows_all_storage_devices(mock_storage_devices):
    nvme_val = DeviceSafetyValidator.validate_for_sanitization("dev_nvme_ssd")
    assert nvme_val["safe"] is True
    assert nvme_val["device_type"] == "NVME"
    assert nvme_val["mount_point"] == "D:\\"

    sata_val = DeviceSafetyValidator.validate_for_sanitization("dev_sata_ssd")
    assert sata_val["safe"] is True
    assert sata_val["device_type"] == "SATA"
    assert sata_val["mount_point"] == "E:\\"

    sys_val = DeviceSafetyValidator.validate_for_sanitization("dev_system_disk")
    assert sys_val["safe"] is False
    assert any("SYSTEM/BOOT DISK" in w for w in sys_val["warnings"])


def test_forensic_validator_allows_all_storage_devices(mock_storage_devices):
    nvme_val = ForensicValidator.validate_for_acquisition("dev_nvme_ssd")
    assert nvme_val["safe"] is True
    assert nvme_val["device_path"] == r"\\.\PHYSICALDRIVE1"
    assert nvme_val["vendor"] == "Samsung"

    sata_val = ForensicValidator.validate_for_acquisition("dev_sata_ssd")
    assert sata_val["safe"] is True
    assert sata_val["device_path"] == r"\\.\PHYSICALDRIVE2"

    sys_val = ForensicValidator.validate_for_acquisition("dev_system_disk")
    assert sys_val["safe"] is False
    assert any("SYSTEM/BOOT DISK" in w for w in sys_val["warnings"])


def test_sanitization_api_validate(mock_storage_devices):
    with TestClient(app) as client:
        res = client.post("/api/sanitization/validate", json={"device_id": "dev_nvme_ssd"})
        assert res.status_code == 200
        data = res.json()
        assert data["safe"] is True
        assert data["device_type"] == "NVME"


def test_forensics_api_create_and_delete_case(mock_storage_devices):
    with TestClient(app) as client:
        res = client.post(
            "/api/forensics/cases",
            json={"case_name": "Test NVMe Case", "device_id": "dev_nvme_ssd", "description": "Testing non-USB device"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["case_name"] == "Test NVMe Case"
        assert "CASE-" in data["case_id"]

        case_id = data["case_id"]
        del_res = client.delete(f"/api/forensics/cases/{case_id}")
        assert del_res.status_code == 200
