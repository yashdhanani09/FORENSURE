from datetime import UTC, datetime
import platform

import pytest

from app.services.filesystem_analyzer import FileBrowserError, analyze_device, browse_files
from app.services.usb_detector import UsbDeviceRecord


def _record(mount_point: str) -> UsbDeviceRecord:
    return UsbDeviceRecord(
        id="usb_test_record",
        device_path="/dev/sdz",
        vendor="Test",
        model="USB",
        serial="test-1",
        usb_version=None,
        manufacturer=None,
        device_class="Mass Storage",
        capacity_bytes=1024,
        filesystem="vfat",
        mount_point=mount_point,
        removable=True,
        read_only=False,
        transport="usb",
        detected_at=datetime.now(UTC),
    )


@pytest.mark.skipif(
    platform.system() == "Windows",
    reason="Creating symlinks on Windows requires Developer Mode or Administrator privileges.",
)
def test_browse_files_lists_metadata_without_following_symlinks(tmp_path) -> None:
    folder = tmp_path / "photos"
    folder.mkdir()
    (tmp_path / "report.txt").write_text("metadata only")
    (folder / "image.jpg").write_bytes(b"jpg")
    (tmp_path / "outside-link").symlink_to("/tmp")

    result = browse_files(_record(str(tmp_path)), sort_by="name")

    assert result.status == "completed"
    assert [entry.name for entry in result.entries] == ["photos", "outside-link", "report.txt"]
    assert next(entry for entry in result.entries if entry.name == "outside-link").kind == "symlink"
    nested = browse_files(_record(str(tmp_path)), path="photos")
    assert nested.entries[0].path == "photos/image.jpg"


def test_file_browse_rejects_escaping_mount(tmp_path) -> None:
    with pytest.raises(FileBrowserError):
        browse_files(_record(str(tmp_path)), path="../outside")


def test_analysis_counts_a_small_mounted_tree(tmp_path) -> None:
    (tmp_path / "nested").mkdir()
    (tmp_path / "one.txt").write_text("one")
    (tmp_path / "nested" / "two.txt").write_text("two")

    result = analyze_device(_record(str(tmp_path)))

    assert result.status == "completed"
    assert result.file_count == 2
    assert result.directory_count == 1
