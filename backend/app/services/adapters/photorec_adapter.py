import subprocess
import logging
import os
import shutil
from typing import List

logger = logging.getLogger(__name__)

class PhotoRecAdapter:
    """Adapter for executing PhotoRec file carving."""

    @staticmethod
    def carve_files(image_path: str, output_dir: str, offset_sectors: int = 0) -> List[str]:
        """
        Runs PhotoRec to carve files from unallocated space.
        Uses /d to specify output dir, /cmd for batch mode.
        """
        # Ensure output directory exists and is empty to avoid mixing
        os.makedirs(output_dir, exist_ok=True)
        
        # PhotoRec command syntax in batch mode:
        # photorec /cmd image.img partition_number,options,search
        # However, photorec is notoriously tricky to script.
        # /d <dir> specifies output dir.
        # We will attempt a basic signature search.
        
        cmd = ["photorec", "/d", output_dir, "/cmd", image_path, "search"]
        
        try:
            logger.info(f"Running PhotoRec carving on {image_path} -> {output_dir}")
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            
            # PhotoRec creates directories like recup_dir.1, recup_dir.2
            recovered_files = []
            for root, _, files in os.walk(output_dir):
                for f in files:
                    if f == "report.xml":
                        continue
                    recovered_files.append(os.path.join(root, f))
                    
            logger.info(f"PhotoRec carved {len(recovered_files)} files.")
            return recovered_files
            
        except subprocess.CalledProcessError as e:
            logger.error(f"PhotoRec failed: {e.stderr}")
            raise Exception(f"PhotoRec carving failed: {e.stderr}")
        except FileNotFoundError:
            logger.warning("PhotoRec tool not found in PATH.")
            raise Exception("PhotoRec tool is not installed on this system.")
