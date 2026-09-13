import json
import subprocess
import logging
from typing import Any

logger = logging.getLogger(__name__)

class LsblkAdapter:
    """Linux adapter for storage discovery using lsblk."""
    
    @staticmethod
    def get_all_disks() -> list[dict[str, Any]]:
        """Returns normalized physical devices from Linux lsblk."""
        try:
            # We use specific columns to capture all required data
            cmd = [
                "lsblk", "--json", "-b", "-O"
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            data = json.loads(res.stdout)
        except Exception as e:
            logger.error(f"lsblk failed: {e}")
            return []
            
        blockdevices = data.get("blockdevices", [])
        
        devices = []
        for disk in blockdevices:
            if disk.get("type") != "disk":
                continue
                
            is_usb = disk.get("tran") == "usb"
            is_removable = disk.get("rm", False) or disk.get("hotplug", False)
            
            partitions = []
            children = disk.get("children", [])
            for child in children:
                if child.get("type") == "part":
                    partitions.append({
                        "partition_path": child.get("name") if child.get("name", "").startswith("/") else f"/dev/{child.get('name')}",
                        "partition_number": child.get("name", "")[-1] if child.get("name") else "1",
                        "partition_size": child.get("size", 0),
                        "partition_filesystem": child.get("fstype"),
                        "partition_uuid": child.get("uuid"),
                        "partition_label": child.get("label") or child.get("partlabel"),
                        "mount_point": child.get("mountpoint"),
                    })
                    
            devices.append({
                "device_path": disk.get("name") if disk.get("name", "").startswith("/") else f"/dev/{disk.get('name')}",
                "kernel_name": disk.get("kname") or disk.get("name"),
                "vendor": disk.get("vendor", "Unknown").strip() if disk.get("vendor") else "Unknown",
                "model": disk.get("model", "Unknown").strip() if disk.get("model") else "Unknown",
                "serial": disk.get("serial") or disk.get("wwn"),
                "wwn": disk.get("wwn"),
                "size_bytes": disk.get("size", 0),
                "bus": disk.get("tran", "unknown").lower(),
                "is_usb": is_usb,
                "is_removable": is_removable,
                "is_system_disk": False, # Enriched later
                "is_read_only": disk.get("ro", False),
                "partitions": partitions
            })
            
        return devices
