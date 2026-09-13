import abc
import os
import time
import logging
from typing import Callable
from app.core.config import get_settings

logger = logging.getLogger(__name__)

class SanitizationMethod(abc.ABC):
    """Abstract base class for all sanitization methods."""
    
    def __init__(self, target_path: str, total_bytes: int):
        self.target_path = target_path
        self.total_bytes = total_bytes
        self.bytes_processed = 0
        self.start_time = 0.0

    @abc.abstractmethod
    def execute(self, progress_callback: Callable[[int, int, float], None]) -> None:
        """
        Executes the sanitization.
        progress_callback receives (bytes_processed, total_bytes, speed_bytes_per_second).
        """
        pass

class ZeroOverwriteMethod(SanitizationMethod):
    """
    Overwrites the physical block device with zeros using pure Python os.write().
    """
    
    def execute(self, progress_callback: Callable[[int, int, float], None]) -> None:
        logger.info(f"Starting zero-overwrite on {self.target_path}")
        
        # 1MB chunks
        chunk_size = 1024 * 1024
        zero_chunk = b'\x00' * chunk_size
        
        self.bytes_processed = 0
        self.start_time = time.time()
        settings = get_settings()
        
        if getattr(settings, "dry_run", False):
            logger.warning(f"DRY RUN: Simulating overwrite on {self.target_path}")
            while self.bytes_processed < self.total_bytes:
                time.sleep(0.5)
                self.bytes_processed += min(chunk_size * 50, self.total_bytes - self.bytes_processed)
                elapsed = time.time() - self.start_time
                speed = self.bytes_processed / elapsed if elapsed > 0 else 0
                progress_callback(self.bytes_processed, self.total_bytes, speed)
            return

        fd = None
        try:
            # os.O_SYNC ensures writes are flushed to physical media
            # macOS might not have O_SYNC, fallback to O_WRONLY
            flags = os.O_WRONLY
            if hasattr(os, "O_BINARY"):
                flags |= os.O_BINARY
            if hasattr(os, "O_SYNC"):
                flags |= os.O_SYNC
                
            fd = os.open(self.target_path, flags)
            
            while self.bytes_processed < self.total_bytes:
                remaining = self.total_bytes - self.bytes_processed
                to_write = chunk_size if remaining >= chunk_size else remaining
                
                # Write chunk
                written = os.write(fd, zero_chunk[:to_write])
                if written == 0:
                    raise IOError("os.write returned 0 bytes written. Device may be disconnected or full.")
                    
                self.bytes_processed += written
                
                # Calculate speed & call progress every ~10MB to avoid spamming
                if self.bytes_processed % (chunk_size * 10) == 0 or self.bytes_processed == self.total_bytes:
                    elapsed = time.time() - self.start_time
                    speed = self.bytes_processed / elapsed if elapsed > 0 else 0
                    progress_callback(self.bytes_processed, self.total_bytes, speed)
                    
            # Final sync
            if hasattr(os, "fsync"):
                os.fsync(fd)
                
            logger.info("Zero-overwrite completed successfully.")
            
        except Exception as e:
            logger.error(f"Zero-overwrite failed: {e}")
            raise
        finally:
            if fd is not None:
                os.close(fd)

class FileOverwriteMethod(SanitizationMethod):
    """
    Overwrites a specific file on a filesystem with zero, random, or DoD patterns, then unlinks it.
    """
    def __init__(self, target_path: str, total_bytes: int, pattern: str = "zero"):
        super().__init__(target_path, total_bytes)
        self.pattern = (pattern or "zero").lower()

    def execute(self, progress_callback: Callable[[int, int, float], None]) -> None:
        logger.info(f"Starting {self.pattern} overwrite on file {self.target_path} ({self.total_bytes} bytes)")
        self.start_time = time.time()
        self.bytes_processed = 0
        chunk_size = 1024 * 1024

        settings = get_settings()
        if getattr(settings, "dry_run", False):
            logger.warning(f"DRY RUN: Simulating overwrite on {self.target_path}")
            while self.bytes_processed < self.total_bytes:
                time.sleep(0.3)
                self.bytes_processed += min(chunk_size * 20, self.total_bytes - self.bytes_processed)
                elapsed = time.time() - self.start_time
                speed = self.bytes_processed / elapsed if elapsed > 0 else 0
                progress_callback(self.bytes_processed, self.total_bytes, speed)
            return

        # Determine pass sequence
        if self.pattern in ("dod", "dod_5220_22_m", "dod522022m"):
            passes = ["zero", "one", "random"]
        elif self.pattern == "random":
            passes = ["random"]
        else:
            passes = ["zero"]

        overall_total = self.total_bytes * len(passes)

        for pass_num, pass_type in enumerate(passes, 1):
            fd = None
            try:
                flags = os.O_WRONLY
                if hasattr(os, "O_BINARY"):
                    flags |= os.O_BINARY
                if hasattr(os, "O_SYNC"):
                    flags |= os.O_SYNC

                fd = os.open(self.target_path, flags)
                os.lseek(fd, 0, os.SEEK_SET)

                pass_written = 0
                while pass_written < self.total_bytes:
                    remaining = self.total_bytes - pass_written
                    to_write = chunk_size if remaining >= chunk_size else remaining

                    if pass_type == "zero":
                        chunk = b'\x00' * to_write
                    elif pass_type == "one":
                        chunk = b'\xFF' * to_write
                    else:
                        chunk = os.urandom(to_write)

                    written = os.write(fd, chunk)
                    if written == 0:
                        raise IOError("os.write returned 0 bytes written during sanitization pass.")

                    pass_written += written
                    self.bytes_processed += written

                    elapsed = time.time() - self.start_time
                    speed = self.bytes_processed / elapsed if elapsed > 0 else 0
                    progress_callback(self.bytes_processed, overall_total, speed)

                if hasattr(os, "fsync"):
                    os.fsync(fd)

            finally:
                if fd is not None:
                    os.close(fd)

        # Unlink file from filesystem
        if not getattr(settings, "dry_run", False):
            logger.info(f"Unlinking sanitized file: {self.target_path}")
            os.remove(self.target_path)


class FileZeroOverwriteMethod(FileOverwriteMethod):
    """Backwards-compatible alias for zero overwrite."""
    def __init__(self, target_path: str, total_bytes: int):
        super().__init__(target_path, total_bytes, pattern="zero")
