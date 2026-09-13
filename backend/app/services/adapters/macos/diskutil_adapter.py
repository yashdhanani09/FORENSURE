import plistlib
import subprocess
import logging
from typing import Any

logger = logging.getLogger(__name__)

class DiskutilAdapter:
    """macOS fallback adapter leveraging diskutil -plist."""
    
    @staticmethod
    def get_all_disks() -> list[dict[str, Any]]:
        """Returns normalized physical devices from macOS."""
        try:
            res = subprocess.run(["diskutil", "list", "-plist"], capture_output=True, check=True)
            data = plistlib.loads(res.stdout)
        except Exception as e:
            logger.error(f"diskutil list failed: {e}")
            return []
            
        whole_disks = data.get("WholeDisks", [])
        all_disks = data.get("AllDisksAndPartitions", [])
        
        devices = []
        for disk_id in whole_disks:
            try:
                info_res = subprocess.run(["diskutil", "info", "-plist", disk_id], capture_output=True, check=True)
                info = plistlib.loads(info_res.stdout)
            except Exception:
                continue
                
            protocol = str(info.get("BusProtocol", ""))
            is_usb = (protocol == "USB")
            is_removable = info.get("RemovableMedia", False) or info.get("RemovableMediaOrExternalDevice", False)
            is_virtual = (info.get("VirtualOrPhysical") == "Virtual")

            # Skip APFS logical volumes, RAM disks, and disk images only
            if is_virtual or protocol == "Disk Image":
                continue
            
            # Find partitions
            partitions = []
            disk_tree = next((d for d in all_disks if d.get("DeviceIdentifier") == disk_id), None)
            
            if disk_tree and "Partitions" in disk_tree:
                for part in disk_tree["Partitions"]:
                    part_id = part.get("DeviceIdentifier")
                    if not part_id:
                        continue
                    try:
                        p_res = subprocess.run(["diskutil", "info", "-plist", part_id], capture_output=True, check=True)
                        p_info = plistlib.loads(p_res.stdout)
                    except Exception:
                        p_info = {}
                        
                    partitions.append({
                        "partition_path": f"/dev/{part_id}",
                        "partition_number": part_id.replace(disk_id + "s", "") if "s" in part_id else "1",
                        "partition_size": p_info.get("Size") or p_info.get("TotalSize") or part.get("Size") or 0,
                        "partition_filesystem": p_info.get("FilesystemType") or part.get("Content") or None,
                        "partition_uuid": p_info.get("VolumeUUID") or part.get("VolumeUUID") or None,
                        "partition_label": p_info.get("VolumeName") or part.get("VolumeName") or None,
                        "mount_point": p_info.get("MountPoint"),
                    })
                    
            size_bytes = info.get("Size") or info.get("TotalSize") or 0
            
            raw_name = info.get("IORegistryEntryName") or info.get("MediaName") or "Unknown Device"
            if raw_name.endswith(" Media"):
                raw_name = raw_name[:-6]
            
            parts = raw_name.split()
            vendor = parts[0] if parts else "Unknown"
            model = " ".join(parts[1:]) if len(parts) > 1 else raw_name
            
            devices.append({
                "device_path": f"/dev/{disk_id}",
                "kernel_name": disk_id,
                "vendor": vendor,
                "model": model,
                "serial": info.get("VolumeUUID") or None, # Fallback to UUID
                "size_bytes": size_bytes,
                "bus": protocol.lower(),
                "is_usb": is_usb,
                "is_removable": is_removable,
                "is_system_disk": info.get("Internal", False),
                "is_read_only": not info.get("Writable", True),
                "partitions": partitions
            })
            
        return devices
