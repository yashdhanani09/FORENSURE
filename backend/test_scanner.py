from app.services.storage_scanner import StorageScannerService
from app.services.system_disk_detector import SystemDiskDetector

print(SystemDiskDetector.get_protected_devices())
