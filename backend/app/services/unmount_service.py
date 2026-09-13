import subprocess
import platform
import logging

logger = logging.getLogger(__name__)


class UnmountService:
    """Handles safe detection and unmounting of partitions on physical devices."""

    @staticmethod
    def _get_drive_number(device_path: str) -> str | None:
        r"""Extract the Windows physical drive number from a path like \\.\PHYSICALDRIVE1."""
        import re
        m = re.search(r"PHYSICALDRIVE(\d+)", device_path, re.IGNORECASE)
        return m.group(1) if m else None

    @staticmethod
    def get_active_mounts(device_path: str) -> list[str]:
        """Returns a list of mount points for the given physical device or partition."""
        mounts: list[str] = []
        try:
            if platform.system() == "Darwin":
                # Use mount command on macOS to see what's mounted
                res = subprocess.run(["mount"], capture_output=True, text=True, check=True)
                for line in res.stdout.strip().split("\n"):
                    if line.startswith(device_path):
                        # Example: /dev/disk8s1 on /Volumes/MAHEK LAD (msdos, local, …)
                        parts = line.split(" on ")
                        if len(parts) > 1:
                            mount_point = parts[1].split(" (")[0]
                            mounts.append(mount_point)

            elif platform.system() == "Windows":
                drive_num = UnmountService._get_drive_number(device_path)
                if drive_num is None:
                    return mounts
                ps_script = (
                    f"Get-Partition -DiskNumber {drive_num} | "
                    "ForEach-Object { try { $v = Get-Volume -Partition $_ -EA Stop; "
                    "if ($v.DriveLetter -and $v.DriveLetter -ne '`0') { \"$($v.DriveLetter):\" } } catch {} }"
                )
                res = subprocess.run(
                    ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
                    capture_output=True, text=True, timeout=10,
                )
                for line in res.stdout.strip().splitlines():
                    line = line.strip()
                    if line:
                        mounts.append(line + "\\")

            else:
                # Use findmnt on Linux
                res = subprocess.run(
                    ["findmnt", "-rn", "-o", "TARGET", "-S", device_path],
                    capture_output=True, text=True,
                )
                if res.returncode == 0:
                    for line in res.stdout.strip().split("\n"):
                        if line:
                            mounts.append(line)

        except Exception as exc:
            logger.error("Failed to detect mounts for %s: %s", device_path, exc)

        return mounts

    @staticmethod
    def is_device_mounted(device_path: str) -> bool:
        """Checks if a device or any of its partitions are currently mounted."""
        return len(UnmountService.get_active_mounts(device_path)) > 0

    @staticmethod
    def unmount_device(device_path: str) -> bool:
        """
        Attempts to safely unmount all partitions belonging to a physical device.
        On macOS, uses ``diskutil unmountDisk``.
        On Linux, iterates partitions and calls ``umount``.
        On Windows, calls ``mountvol <letter>: /P`` for each mounted volume.
        Returns True if successful (or if it wasn't mounted), False if it failed.
        """
        logger.info("Unmounting device %s", device_path)

        # If not mounted, we're good
        if not UnmountService.is_device_mounted(device_path):
            return True

        try:
            if platform.system() == "Darwin":
                res = subprocess.run(
                    ["diskutil", "unmountDisk", device_path],
                    capture_output=True, text=True,
                )
                if res.returncode != 0:
                    logger.error("diskutil unmountDisk failed: %s", res.stderr)
                    return False

            elif platform.system() == "Windows":
                mounts = UnmountService.get_active_mounts(device_path)
                for letter_path in mounts:
                    # letter_path is e.g. "E:\"  — mountvol expects "E:\"
                    res = subprocess.run(
                        ["mountvol", letter_path, "/P"],
                        capture_output=True, text=True,
                    )
                    if res.returncode != 0:
                        logger.error(
                            "mountvol /P failed for %s: %s", letter_path, res.stderr
                        )
                        return False

            else:
                # Linux: find all mounts and unmount them
                mounts = UnmountService.get_active_mounts(device_path)
                for mnt in mounts:
                    res = subprocess.run(["umount", mnt], capture_output=True, text=True)
                    if res.returncode != 0:
                        logger.error("umount failed for %s: %s", mnt, res.stderr)
                        return False

            # Final verification
            return not UnmountService.is_device_mounted(device_path)

        except Exception as exc:
            logger.error("Unmount error for %s: %s", device_path, exc)
            return False

