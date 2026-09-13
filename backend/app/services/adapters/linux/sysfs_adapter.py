import os
import logging

logger = logging.getLogger(__name__)

class SysfsAdapter:
    """Linux adapter for querying /sys/class/block for low-level properties."""
    
    @staticmethod
    def get_rotational_status(kernel_name: str) -> bool:
        """Reads /sys/class/block/{kernel_name}/queue/rotational"""
        try:
            path = f"/sys/class/block/{kernel_name}/queue/rotational"
            if os.path.exists(path):
                with open(path, "r") as f:
                    return f.read().strip() == "1"
        except Exception:
            pass
        return False
