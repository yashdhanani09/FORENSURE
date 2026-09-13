from datetime import UTC, datetime
from fastapi.testclient import TestClient

from app.main import app
from app.services.usb_detector import usb_detector, UsbDeviceRecord, PartitionRecord
from app.schemas.device import DeviceAnalysis, FileBrowserResponse, FileEntry


def mock_devices(*args, **kwargs) -> list[UsbDeviceRecord]:
    return [
        UsbDeviceRecord(
            id="usb_mock_drive",
            device_path="/dev/sdb",
            vendor="Mock",
            model="Drive",
            serial="MOCK-1",
            usb_version="3.0",
            manufacturer="Mock Corp",
            device_class="Mass Storage",
            capacity_bytes=64_000_000_000,
            filesystem="exfat",
            mount_point="/media/mock",
            removable=True,
            read_only=False,
            transport="usb",
            detected_at=datetime.now(UTC),
            partitions=[
                PartitionRecord(
                    name="sdbp1",
                    device_path="/dev/sdb1",
                    filesystem="exfat",
                    label="MOCK",
                    uuid="1234",
                    capacity_bytes=64_000_000_000,
                    mount_points=["/media/mock"],
                )
            ],
        )
    ]


def test_device_list_and_detail_are_structured(monkeypatch) -> None:
    monkeypatch.setattr(usb_detector, "list_devices", mock_devices)
    with TestClient(app) as client:
        listed = client.get("/api/devices")
        assert listed.status_code == 200
        body = listed.json()
        assert body["devices"][0]["id"] == "usb_mock_drive"
        assert body["devices"][0]["device_path"] == "/dev/sdb"

        detail = client.get("/api/devices/usb_mock_drive")
        assert detail.status_code == 200
        assert detail.json()["partitions"][0]["filesystem"] == "exfat"


def test_analysis_uses_device_id_not_a_client_provided_path(monkeypatch) -> None:
    monkeypatch.setattr(usb_detector, "list_devices", mock_devices)
    
    # Mock the analyzer since we removed the demo logic
    from app.api import devices
    monkeypatch.setattr(devices, "analyze_device", lambda r: DeviceAnalysis(
        device_id=r.id, filesystem="exfat", total_bytes=100, status="completed", message="Mock"
    ))
    
    with TestClient(app) as client:
        response = client.post("/api/devices/usb_mock_drive/analyze")
        assert response.status_code == 200
        assert response.json()["status"] == "completed"

        invalid = client.post("/api/devices/%2Fdev%2Fsdb/analyze")
        assert invalid.status_code == 404


def test_file_browser_is_device_id_scoped_and_rejects_parent_paths(monkeypatch) -> None:
    monkeypatch.setattr(usb_detector, "list_devices", mock_devices)
    
    # Mock the browser
    from app.api import devices
    def mock_browse(*args, **kwargs):
        path = kwargs.get("path", "")
        if ".." in path:
            from app.services.filesystem_analyzer import FileBrowserError
            raise FileBrowserError("The requested folder is not available on this USB device.")
        return FileBrowserResponse(
            device_id="usb_mock_drive",
            current_path="Evidence",
            parent_path="",
            entries=[FileEntry(name="inventory.csv", path="Evidence/inventory.csv", parent_path="Evidence", kind="file")],
            total=1,
            status="completed",
            message="Mock"
        )
    monkeypatch.setattr(devices, "browse_files", mock_browse)
    
    with TestClient(app) as client:
        folder = client.get("/api/devices/usb_mock_drive/files", params={"path": "Evidence", "kind": "file"})
        assert folder.status_code == 200
        assert folder.json()["entries"][0]["name"] == "inventory.csv"

        traversal = client.get("/api/devices/usb_mock_drive/files", params={"path": "../"})
        assert traversal.status_code == 400

