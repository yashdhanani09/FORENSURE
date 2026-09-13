import asyncio
import logging
import os
import time

from app.schemas.verification import OffsetVerification, VerificationResult
from app.services.filesystem_analyzer import FileBrowserError
from app.services.usb_detector import UsbDeviceRecord

logger = logging.getLogger(__name__)

# Constants for verification
CHUNK_SIZE = 1024 * 1024  # 1MB per sample
SAMPLE_PERCENTAGES = [0.0, 0.25, 0.5, 0.75, 0.99]

async def verify_wipe(record: UsbDeviceRecord) -> VerificationResult:
    """Verifies that a block device has been successfully wiped by sampling multiple locations."""
    if not record.device_path:
        raise FileBrowserError("Device path unavailable for verification.")
        
    if not record.capacity_bytes:
        raise FileBrowserError("Device capacity is unknown, cannot sample device safely.")
        
    try:
        samples = []
        is_zeroed = True
        
        # We need to read from the raw block device.
        # This requires root privileges.
        fd = os.open(record.device_path, os.O_RDONLY)
        try:
            for pct in SAMPLE_PERCENTAGES:
                # Calculate offset. Make sure it's block-aligned (e.g. 512 bytes)
                raw_offset = int(record.capacity_bytes * pct)
                offset = (raw_offset // 512) * 512
                
                os.lseek(fd, offset, os.SEEK_SET)
                chunk = os.read(fd, CHUNK_SIZE)
                
                # Verify chunk is all zeros
                passed = all(b == 0 for b in chunk)
                samples.append(
                    OffsetVerification(
                        offset_bytes=offset,
                        passed=passed
                    )
                )
                if not passed:
                    is_zeroed = False
                    
        finally:
            os.close(fd)
            
        message = "Verification successful." if is_zeroed else "Verification failed. Device contains non-zero data."
        return VerificationResult(
            device_id=record.id,
            status="completed",
            message=message,
            is_zeroed=is_zeroed,
            sampled_offsets=samples
        )
        
    except PermissionError:
        raise FileBrowserError("Permission denied: Cannot read block device. Run as root.")
    except OSError as e:
        logger.error(f"Failed to verify device {record.device_path}: {e}")
        raise FileBrowserError(f"IO Error during verification: {str(e)}")
