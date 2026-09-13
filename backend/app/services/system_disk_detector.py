import platform
import subprocess
import logging
import re

logger = logging.getLogger(__name__)


class SystemDiskDetector:
    """Detects which physical block devices are protected system disks."""

    @staticmethod
    def get_protected_devices() -> set[str]:
        """Returns a set of device paths that should be protected."""
        protected: set[str] = set()

        try:
            if platform.system() == "Darwin":
                # macOS: Find the root partition and trace back to the whole disk.
                res = subprocess.run(["df", "/"], capture_output=True, text=True, check=True)
                lines = res.stdout.strip().split("\n")
                if len(lines) > 1:
                    root_part = lines[1].split()[0]  # e.g. /dev/disk3s1s1
                    if root_part.startswith("/dev/disk"):
                        match = re.match(r"(/dev/disk\d+)", root_part)
                        if match:
                            protected.add(match.group(1))

            elif platform.system() == "Windows":
                # Windows: find which PHYSICALDRIVE hosts the system volume (usually C:\).
                ps_script = (
                    "$sys = $env:SystemDrive.TrimEnd('\\'); "
                    "$part = Get-Partition | Where-Object { $_.DriveLetter -eq $sys[0] } | Select-Object -First 1; "
                    "if ($part) { Write-Output $part.DiskNumber }"
                )
                res = subprocess.run(
                    ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
                    capture_output=True, text=True, timeout=10,
                )
                if res.returncode == 0 and res.stdout.strip():
                    disk_num = res.stdout.strip()
                    protected.add(f"\\\\.\\PHYSICALDRIVE{disk_num}")

            else:
                # Linux: Use findmnt to trace / and /boot back to their physical disks.
                for target in ["/", "/boot"]:
                    try:
                        res = subprocess.run(
                            ["findmnt", "-n", "-o", "SOURCE", target],
                            capture_output=True, text=True,
                        )
                        if res.returncode == 0 and res.stdout.strip():
                            source = res.stdout.strip()  # e.g. /dev/sda1
                            lsblk_res = subprocess.run(
                                ["lsblk", "-no", "PKNAME", source],
                                capture_output=True, text=True,
                            )
                            if lsblk_res.returncode == 0 and lsblk_res.stdout.strip():
                                parent = lsblk_res.stdout.strip()
                                protected.add(f"/dev/{parent}")
                            else:
                                protected.add(source)
                    except Exception:
                        pass

        except Exception as exc:
            logger.error("Failed to detect system disks: %s", exc)

        return protected

