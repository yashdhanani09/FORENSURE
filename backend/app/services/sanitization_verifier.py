import os
import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)

class SanitizationVerifier:
    """Verifies that sanitization was successful."""
    
    @staticmethod
    def verify_file_erased(target_path: str) -> dict:
        """
        Verifies that the target file has been successfully unlinked from the filesystem.
        """
        logger.info(f"Starting verification on {target_path}")
        
        settings = get_settings()
        if getattr(settings, "dry_run", False):
            logger.warning(f"DRY RUN: Simulating successful verification on {target_path}")
            return {
                "status": "PASSED",
                "method": "file_absence_check (dry_run)",
                "scope": "simulated",
                "reason": "Dry run verification forced success."
            }
        
        try:
            if os.path.exists(target_path):
                return {
                    "status": "FAILED",
                    "method": "file_absence_check",
                    "scope": "file_system",
                    "reason": "File still exists on the filesystem."
                }
                    
            logger.info("Verification passed.")
            return {
                "status": "PASSED",
                "method": "file_absence_check",
                "scope": "file_system",
                "reason": "File was successfully unlinked."
            }
            
        except Exception as e:
            logger.error(f"Verification encountered an error: {e}")
            return {
                "status": "ERROR",
                "method": "file_absence_check",
                "scope": "unknown",
                "reason": str(e)
            }
