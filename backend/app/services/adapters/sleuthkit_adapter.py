import subprocess
import logging
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class SleuthKitAdapter:
    """Adapter for executing and parsing output from The Sleuth Kit (TSK) tools."""

    @staticmethod
    def run_command(command: List[str]) -> str:
        """Executes a TSK command and returns its stdout as string."""
        try:
            logger.info(f"Running TSK command: {' '.join(command)}")
            result = subprocess.run(command, check=True, capture_output=True, text=True)
            return result.stdout
        except subprocess.CalledProcessError as e:
            logger.error(f"TSK command failed: {e.stderr}")
            raise Exception(f"TSK Command failed: {' '.join(command)}")
        except FileNotFoundError:
            logger.warning(f"TSK tool '{command[0]}' not found in PATH.")
            raise Exception(f"TSK tool '{command[0]}' is not installed on this system.")

    @staticmethod
    def get_partitions(image_path: str) -> List[Dict[str, Any]]:
        """Parses `mmls` to find partitions."""
        partitions = []
        try:
            stdout = SleuthKitAdapter.run_command(["mmls", image_path])
        except Exception:
            # Not all images have partition tables (some are raw filesystems).
            return partitions
            
        # Example mmls output:
        # 05:  00:00  0000000000   0000002047   0000002048   Unallocated
        # 06:  Meta   0000000002   0000000000   0000000001   GPT Header
        # 07:  01:00  0000002048   0030513151   0030511104   EFI System (FAT)
        
        lines = stdout.strip().split("\n")
        header_found = False
        for line in lines:
            if "Start" in line and "End" in line and "Length" in line:
                header_found = True
                continue
            if not header_found or "Meta" in line or not line.strip():
                continue
                
            parts = re.split(r'\s{2,}', line.strip())
            if len(parts) >= 5:
                partitions.append({
                    "slot": parts[0].strip(),
                    "start": int(parts[2]),
                    "end": int(parts[3]),
                    "length": int(parts[4]),
                    "description": parts[5] if len(parts) > 5 else "Unknown",
                    "allocated": "Unallocated" not in parts[5] if len(parts) > 5 else True
                })
        return partitions

    @staticmethod
    def get_filesystem_info(image_path: str, offset_sectors: int = 0) -> Dict[str, Any]:
        """Parses `fsstat` to identify filesystem metadata."""
        cmd = ["fsstat"]
        if offset_sectors > 0:
            cmd.extend(["-o", str(offset_sectors)])
        cmd.append(image_path)
        
        try:
            stdout = SleuthKitAdapter.run_command(cmd)
        except Exception:
            return {"type": "Unknown", "block_size": 512}
            
        fs_type = "Unknown"
        block_size = 512
        
        for line in stdout.split("\n"):
            if line.startswith("File System Type:"):
                fs_type = line.split(":", 1)[1].strip()
            elif line.startswith("Block Size:") or line.startswith("Sector Size:"):
                block_size_str = line.split(":", 1)[1].strip()
                # Handle possible "512 bytes" format
                import string
                num = "".join([c for c in block_size_str if c in string.digits])
                if num:
                    block_size = int(num)
                    
        return {"type": fs_type, "block_size": block_size}

    @staticmethod
    def enumerate_files(image_path: str, offset_sectors: int = 0) -> List[Dict[str, Any]]:
        """Parses `fls -r -p -l -d/-a` to recursively list all files and deleted files."""
        files = []
        cmd = ["fls", "-r", "-p", "-l"]
        if offset_sectors > 0:
            cmd.extend(["-o", str(offset_sectors)])
        cmd.append(image_path)
        
        try:
            stdout = SleuthKitAdapter.run_command(cmd)
        except Exception:
            return files
            
        # Example fls -l output:
        # r/r * 1234:    file.txt    2023-01-01 12:00:00 (UTC) ...
        # d/d 1235:    folder      2023-01-01 12:00:00 (UTC) ...
        
        for line in stdout.split("\n"):
            if not line.strip():
                continue
            
            # Very basic parsing of TSK fls format.
            # Example: "r/r * 41:	DeletedFolder/secret.txt	... "
            is_deleted = "*" in line.split(":")[0]
            is_dir = line.startswith("d")
            
            # Extract inode
            inode_match = re.search(r'(\d+):', line)
            inode = inode_match.group(1) if inode_match else ""
            
            # Extract filename (fls puts a tab before the filename)
            parts = line.split("\t")
            filename_part = parts[1] if len(parts) > 1 else ""
            
            # Filename often has trailing spaces and timestamps
            # In `-l` (long) format, the filename part includes size and dates separated by tabs
            if len(parts) > 1:
                filename = parts[1].strip()
                size = 0
                if len(parts) > 6: # Standard `fls -l` output structure varies by FS
                    try:
                        size = int(parts[-6]) # Approximate size field
                    except:
                        pass
                
                # Exclude . and ..
                if filename.endswith("/.") or filename.endswith("/.."):
                    continue
                    
                files.append({
                    "name": filename.split("/")[-1] if "/" in filename else filename,
                    "path": filename,
                    "inode": inode,
                    "is_deleted": is_deleted,
                    "is_dir": is_dir,
                    "size": size
                })
        
        return files

    @staticmethod
    def recover_file(image_path: str, inode: str, output_path: str, offset_sectors: int = 0) -> bool:
        """Uses `icat` to extract a file's content by inode."""
        cmd = ["icat"]
        if offset_sectors > 0:
            cmd.extend(["-o", str(offset_sectors)])
        cmd.extend([image_path, str(inode)])
        
        try:
            logger.info(f"Running icat for inode {inode} to {output_path}")
            # we don't capture_output=True as a string because it's binary data
            # we write stdout directly to the file
            with open(output_path, "wb") as f:
                subprocess.run(cmd, check=True, stdout=f)
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"icat failed for inode {inode}: {e}")
            return False
