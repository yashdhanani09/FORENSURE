import os
import pytest
from unittest.mock import patch, MagicMock
from app.services.recovery_service import (
    build_device_profile,
    scan_device_deleted_files,
    generate_forensic_recovery_report,
    SCANNED_DELETED_CACHE,
)
from app.schemas.recovery import DeletedFileItem, RecoveryScanResponse, ForensicReportResponse


def test_device_profile_hdd_usb():
    usb_dev = {
        "id": "usb_test_1",
        "vendor": "SanDisk",
        "model": "Ultra USB 3.0",
        "device_type": "USB_STORAGE",
        "device_path": "E:\\",
        "mount_point": "E:\\",
        "size_bytes": 16000000000,
        "is_removable": True,
    }
    profile, acq_hash = build_device_profile(usb_dev)
    assert profile["category"] == "HDD / USB / SD"
    assert profile["read_only_access"] is True
    assert len(acq_hash) == 64
    assert profile["pipeline_steps"][0]["id"] == "SELECT_DEVICE"
    assert any(step["id"] == "SHA256_HASH" for step in profile["pipeline_steps"])


def test_device_profile_ssd_nvme():
    ssd_dev = {
        "id": "nvme_test_1",
        "vendor": "Samsung",
        "model": "NVMe SSD 980 PRO 1TB",
        "device_type": "INTERNAL_STORAGE",
        "device_path": "\\\\.\\PhysicalDrive0",
        "mount_point": "C:\\",
        "size_bytes": 1000000000000,
        "is_removable": False,
        "media_type": "SSD",
    }
    profile, acq_hash = build_device_profile(ssd_dev)
    assert profile["category"] == "SSD / NVMe"
    assert "TRIM" in profile["trim_status"]
    assert profile["read_only_access"] is True
    assert len(acq_hash) == 64


def test_device_profile_forensic_image(tmp_path):
    img_file = tmp_path / "evidence_test.raw"
    img_file.write_bytes(b"A" * 1024)

    profile, acq_hash = build_device_profile({}, image_path=str(img_file))
    assert profile["category"] == "Forensic Disk Image"
    assert profile["read_only_access"] is True
    assert len(acq_hash) == 64


def test_generate_forensic_recovery_report():
    dev = {
        "id": "test_report_dev",
        "vendor": "Kingston",
        "model": "DataTraveler 3.0",
        "device_type": "USB_STORAGE",
        "device_path": "F:\\",
        "mount_point": "F:\\",
    }
    build_device_profile(dev)
    report = generate_forensic_recovery_report("test_report_dev")
    assert isinstance(report, ForensicReportResponse)
    assert report.device_id == "test_report_dev"
    assert "Forensic File Recovery Examination Report" in report.executive_summary
    assert report.acquisition_hash is not None
    assert len(report.acquisition_hash) > 0
