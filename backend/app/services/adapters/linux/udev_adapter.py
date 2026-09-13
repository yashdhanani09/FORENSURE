import subprocess
import logging

logger = logging.getLogger(__name__)

class UdevAdapter:
    """Linux adapter for querying udev for device properties."""
    
    @staticmethod
    def get_device_properties(device_path: str) -> dict[str, str]:
        """Queries udevadm info for a specific device."""
        props = {}
        try:
            res = subprocess.run(
                ["udevadm", "info", "--query=property", f"--name={device_path}"],
                capture_output=True, text=True
            )
            if res.returncode == 0:
                for line in res.stdout.strip().split("\n"):
                    if "=" in line:
                        key, val = line.split("=", 1)
                        props[key] = val
        except Exception as e:
            logger.error(f"udevadm failed for {device_path}: {e}")
            
        return props
