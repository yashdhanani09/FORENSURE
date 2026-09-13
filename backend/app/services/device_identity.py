import hashlib
import logging
from typing import Any

logger = logging.getLogger(__name__)

def generate_stable_id(device_data: dict[str, Any]) -> str:
    """
    Generates a stable identifier for a physical device based on available hardware attributes.
    Falls back gracefully if serial/WWN are missing.
    """
    components = []
    
    # Best case: Serial Number or WWN is available
    if device_data.get("serial"):
        components.append(device_data["serial"])
    if device_data.get("wwn"):
        components.append(device_data["wwn"])
        
    # If no unique hardware identifiers, use vendor, model, and size
    if not components:
        components.append(device_data.get("vendor", "UNKNOWN_VENDOR"))
        components.append(device_data.get("model", "UNKNOWN_MODEL"))
        components.append(str(device_data.get("size_bytes", 0)))
        
    # Worst case: Just use the kernel name (will change between boots, but better than random)
    if len(components) == 3 and components[0] == "UNKNOWN_VENDOR" and components[1] == "UNKNOWN_MODEL" and components[2] == "0":
        components.append(device_data.get("kernel_name", "UNKNOWN_DEVICE"))
        
    raw_id = "_".join(components).replace(" ", "")
    
    # Create a stable 16-char hash
    hash_obj = hashlib.sha256(raw_id.encode('utf-8'))
    return f"dev-{hash_obj.hexdigest()[:16]}"
