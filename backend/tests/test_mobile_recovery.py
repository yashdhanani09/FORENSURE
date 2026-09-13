import os
import pytest
from unittest.mock import patch, MagicMock
from app.services.mobile_recovery import _get_category, scan_mobile_deleted_files
from app.services.recovery_service import scan_device_deleted_files, restore_files, SCANNED_DELETED_CACHE
from app.schemas.recovery import DeletedFileItem

def test_mobile_category_mapping():
    assert _get_category("jpg") == "Image"
    assert _get_category("heic") == "Image"
    assert _get_category("mp4") == "Media"
    assert _get_category("opus") == "Media"
    assert _get_category("apk") == "Code"
    assert _get_category("pdf") == "Document"
    assert _get_category("zip") == "Archive"
    assert _get_category("xyz") == "Other"

def test_scan_device_routes_to_mobile():
    mock_mobile_device = {
        "id": "dev_mobile_test",
        "vendor": "Motorola",
        "model": "moto g64 5G",
        "device_type": "MOBILE_DEVICE",
        "device_path": r"\\.\WPD\USB\VID_22B8&PID_2E82",
        "mount_point": r"\\.\WPD\USB\VID_22B8&PID_2E82",
        "partitions": [{"partition_filesystem": "MTP", "partition_path": r"\\.\WPD\USB\VID_22B8&PID_2E82\Storage"}]
    }

    mock_item = DeletedFileItem(
        id="mob_test_123",
        filename="test_photo.jpg",
        original_path=r"Internal shared storage\DCIM\Camera\.trashed-123-test_photo.jpg",
        source_path="mobile://test_shell_path",
        size_bytes=1024,
        extension="jpg",
        category="Image",
        confidence="HIGH",
        confidence_score=95,
        validation_details="Android Scoped Storage Trash payload (.trashed)",
        recovery_method="android_scoped_trash",
        recoverable=True,
    )

    with patch("app.services.mobile_recovery.scan_mobile_deleted_files", return_value=[mock_item]) as mock_scan:
        results = scan_device_deleted_files(mock_mobile_device)
        assert mock_scan.called
        assert len(results) == 1
        assert results[0].filename == "test_photo.jpg"
        assert results[0].recovery_method == "android_scoped_trash"
        assert SCANNED_DELETED_CACHE.get("mob_test_123") is not None

def test_restore_mobile_file_invoked(tmp_path):
    mock_item = DeletedFileItem(
        id="mob_restore_test",
        filename="recovered_video.mp4",
        original_path=r"Internal shared storage\DCIM\Camera\.trashed-999-recovered_video.mp4",
        source_path="mobile://test_shell_path",
        size_bytes=2048,
        extension="mp4",
        category="Media",
        confidence="HIGH",
        confidence_score=95,
        validation_details="Android Scoped Storage Trash payload (.trashed)",
        recovery_method="android_scoped_trash",
        recoverable=True,
    )
    SCANNED_DELETED_CACHE["mob_restore_test"] = mock_item

    mock_out_file = tmp_path / "recovered_video.mp4"
    mock_out_file.write_bytes(b"dummy video content")

    with patch("app.services.mobile_recovery.restore_mobile_file", return_value=(True, str(mock_out_file), 19, "mockhash", "")) as mock_restore:
        restored = restore_files(["mob_restore_test"], destination_folder=str(tmp_path))
        assert len(restored) == 1
        assert restored[0].status == "RECOVERED"
        assert restored[0].filename == "recovered_video.mp4"
