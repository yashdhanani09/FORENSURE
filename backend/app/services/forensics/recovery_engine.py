import os
import hashlib
import logging
from typing import Callable, List, Dict, Any

from app.core.config import get_settings
from app.services.adapters.sleuthkit_adapter import SleuthKitAdapter
from app.services.adapters.photorec_adapter import PhotoRecAdapter

logger = logging.getLogger(__name__)

class RecoveryEngine:
    """Orchestrates recovery of deleted files."""

    @staticmethod
    def recover_files(
        image_path: str,
        files_to_recover: List[Dict[str, Any]],
        output_dir: str,
        method: str,
        progress_callback: Callable[[int, int, str], None]
    ) -> List[Dict[str, Any]]:
        """
        Recovers files using either metadata (icat) or carving (photorec).
        Returns a list of recovery results.
        """
        logger.info(f"Starting recovery of {len(files_to_recover)} files via {method}")
        os.makedirs(output_dir, exist_ok=True)
        
        results = []
        total_files = len(files_to_recover)
        
        if method == "metadata":
            for i, f_meta in enumerate(files_to_recover):
                progress_callback(i, total_files, "RECOVERING")
                
                filename = f_meta.get("name", f"recovered_{i}")
                # Sanitize filename to prevent path traversal
                filename = os.path.basename(filename)
                
                inode = f_meta.get("inode")
                offset = f_meta.get("partition_offset", 0)
                
                out_path = os.path.join(output_dir, filename)
                
                # Prevent overwriting
                counter = 1
                base_name, ext = os.path.splitext(filename)
                while os.path.exists(out_path):
                    out_path = os.path.join(output_dir, f"{base_name}_{counter}{ext}")
                    counter += 1
                
                settings = get_settings()
                if getattr(settings, "dry_run", False):
                    import time
                    time.sleep(1)
                    with open(out_path, "wb") as dummy:
                        dummy.write(b"This is a mocked recovered file content for the demo.")
                    success = True
                else:
                    if inode:
                        success = SleuthKitAdapter.recover_file(image_path, inode, out_path, offset_sectors=offset)
                
                if success and os.path.exists(out_path):
                    size = os.path.getsize(out_path)
                    
                    # Hash it
                    hasher = hashlib.sha256()
                    with open(out_path, "rb") as f:
                        for chunk in iter(lambda: f.read(4096), b""):
                            hasher.update(chunk)
                    
                    results.append({
                        "original_meta": f_meta,
                        "output_path": out_path,
                        "size_bytes": size,
                        "sha256": hasher.hexdigest(),
                        "status": "RECOVERED" if size > 0 else "PARTIAL"
                    })
                else:
                    results.append({
                        "original_meta": f_meta,
                        "status": "FAILED"
                    })
                    
        elif method == "file_carving":
            progress_callback(0, total_files, "CARVING")
            # PhotoRec operates on the whole image (or partition), not individual selected files easily.
            # We just run it and see what we get.
            try:
                carved_paths = PhotoRecAdapter.carve_files(image_path, output_dir)
                for i, out_path in enumerate(carved_paths):
                    size = os.path.getsize(out_path)
                    hasher = hashlib.sha256()
                    with open(out_path, "rb") as f:
                        for chunk in iter(lambda: f.read(4096), b""):
                            hasher.update(chunk)
                            
                    results.append({
                        "original_meta": {"name": os.path.basename(out_path)}, # No original metadata for carved files
                        "output_path": out_path,
                        "size_bytes": size,
                        "sha256": hasher.hexdigest(),
                        "status": "RECOVERED"
                    })
            except Exception as e:
                logger.error(f"Carving failed: {e}")
                
        progress_callback(total_files, total_files, "COMPLETED")
        return results
