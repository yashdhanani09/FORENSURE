import os
import time
import hashlib
import logging
from typing import Callable

from app.core.config import get_settings

logger = logging.getLogger(__name__)

class AcquisitionEngine:
    """
    Acquires a forensic image by reading a block device directly and writing 
    to a destination file, while calculating SHA-256 on the fly.
    """

    @staticmethod
    def acquire_image(
        device_path: str, 
        image_path: str, 
        total_size: int, 
        progress_callback: Callable[[int, int, str], None]
    ) -> str:
        """
        Reads from device_path and writes to image_path.
        Calculates SHA-256 and returns the hex digest.
        Callback gets (bytes_processed, total_size, stage)
        """
        logger.info(f"Starting forensic acquisition of {device_path} to {image_path}")
        
        # On macOS, use /dev/rdisk instead of /dev/disk for raw (unbuffered) fast access
        if device_path.startswith("/dev/disk"):
            raw_device_path = device_path.replace("/dev/disk", "/dev/rdisk")
            if os.path.exists(raw_device_path):
                device_path = raw_device_path
                
        chunk_size = 4 * 1024 * 1024  # 4 MB chunks
        hasher = hashlib.sha256()
        bytes_processed = 0
        
        settings = get_settings()
        if getattr(settings, "dry_run", False):
            logger.warning("DRY RUN: Simulating image acquisition.")
            import time
            time.sleep(2)
            # Create a dummy image file so that analysis step doesn't fail os.path.exists
            os.makedirs(os.path.dirname(image_path), exist_ok=True)
            with open(image_path, "wb") as f:
                f.write(b"Mock Forensic Image")
            progress_callback(total_size, total_size, "COMPLETED")
            return "simulated_hash_1234567890abcdef"

        try:
            # Ensure the directory exists
            os.makedirs(os.path.dirname(image_path), exist_ok=True)

            with open(device_path, "rb") as source, open(image_path, "wb") as dest:
                # Tell the progress callback we're starting
                progress_callback(0, total_size, "ACQUIRING")
                
                while True:
                    chunk = source.read(chunk_size)
                    if not chunk:
                        break
                        
                    dest.write(chunk)
                    hasher.update(chunk)
                    
                    bytes_processed += len(chunk)
                    
                    # Update progress every so often to avoid spam
                    # (In a real app, you might throttle the callback to 1Hz)
                    if bytes_processed % (chunk_size * 25) == 0:
                        progress_callback(bytes_processed, total_size, "ACQUIRING")
                
                # Force flush to disk
                dest.flush()
                os.fsync(dest.fileno())
                
        except PermissionError:
            logger.error(f"Permission denied to read {device_path}. Are you running as root/sudo?")
            raise Exception("PERMISSION_DENIED - Cannot acquire device. Run as root/administrator.")
        except Exception as e:
            logger.error(f"Acquisition failed: {e}")
            raise Exception(f"ACQUISITION_FAILED - {str(e)}")
            
        final_hash = hasher.hexdigest()
        logger.info(f"Acquisition complete. SHA-256: {final_hash}")
        progress_callback(bytes_processed, total_size, "COMPLETED")
        
        return final_hash
