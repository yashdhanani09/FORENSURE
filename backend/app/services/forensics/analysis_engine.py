import os
import json
import logging
from typing import Callable

from app.core.config import get_settings
from app.services.adapters.sleuthkit_adapter import SleuthKitAdapter

logger = logging.getLogger(__name__)

class AnalysisEngine:
    """Orchestrates parsing of a forensic image to identify filesystems and enumerate files."""

    @staticmethod
    def analyze_image(
        image_path: str,
        case_id: str,
        output_dir: str,
        progress_callback: Callable[[int, int, str], None]
    ) -> str:
        """
        Runs partition analysis, filesystem detection, and file enumeration.
        Saves the results to an index JSON file.
        Returns the path to the index file.
        """
        logger.info(f"Starting forensic analysis on image {image_path}")
        os.makedirs(output_dir, exist_ok=True)
        index_path = os.path.join(output_dir, f"{case_id}_file_index.json")
        
        settings = get_settings()
        if getattr(settings, "dry_run", False):
            logger.warning("DRY RUN: Simulating forensic analysis with mock data.")
            import time
            time.sleep(2)
            mock_files = [
                {"name": "hi.pdf", "path": "hi.pdf", "is_dir": False, "size": 120459, "is_deleted": True, "inode": "4-128-1", "partition_offset": 0, "filesystem": "exfat"},
                {"name": "Financial_Report_2025.xlsx", "path": "Financial_Report_2025.xlsx", "is_dir": False, "size": 45012, "is_deleted": True, "inode": "5-128-2", "partition_offset": 0, "filesystem": "exfat"},
                {"name": "System Volume Information", "path": "System Volume Information", "is_dir": True, "size": 0, "is_deleted": False, "inode": "6-128-3", "partition_offset": 0, "filesystem": "exfat"},
            ]
            with open(index_path, "w") as f:
                json.dump({
                    "case_id": case_id,
                    "partitions": [{"start": 0, "end": 1000000, "description": "exFAT Partition", "allocated": True}],
                    "files": mock_files
                }, f)
            progress_callback(100, 100, "COMPLETED")
            return index_path
        
        progress_callback(10, 100, "PARTITION_ANALYSIS")
        partitions = SleuthKitAdapter.get_partitions(image_path)
        
        # If no partitions found (maybe raw filesystem like a flash drive without MBR/GPT)
        # We will assume a single partition at offset 0
        offsets_to_scan = []
        if not partitions:
            offsets_to_scan.append(0)
        else:
            for p in partitions:
                if p.get("allocated"):
                    offsets_to_scan.append(p["start"])
        
        all_files = []
        
        total_offsets = len(offsets_to_scan)
        for i, offset in enumerate(offsets_to_scan):
            logger.info(f"Scanning filesystem at offset {offset}")
            progress_callback(20 + int((i/total_offsets)*20), 100, "FILESYSTEM_ANALYSIS")
            
            fs_info = SleuthKitAdapter.get_filesystem_info(image_path, offset_sectors=offset)
            
            progress_callback(40 + int((i/total_offsets)*40), 100, "FILE_ENUMERATION")
            files = SleuthKitAdapter.enumerate_files(image_path, offset_sectors=offset)
            
            for f in files:
                f["partition_offset"] = offset
                f["filesystem"] = fs_info["type"]
                all_files.append(f)
                
        progress_callback(90, 100, "SAVING_INDEX")
        
        with open(index_path, "w") as f:
            json.dump({
                "case_id": case_id,
                "partitions": partitions,
                "files": all_files
            }, f)
            
        progress_callback(100, 100, "COMPLETED")
        logger.info(f"Analysis complete. Found {len(all_files)} files. Saved index to {index_path}")
        
        return index_path
