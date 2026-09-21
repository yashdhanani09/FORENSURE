"""Windows storage adapter — all physical disks.

Uses PowerShell cmdlets (Get-Disk, Get-Partition, Get-Volume) which are
available inbox on all Windows 10/11 machines — no extra tools required.

Enumerates ALL physical disks regardless of bus type (USB, SATA, NVMe,
SCSI, MMC, etc.) so the pipeline sees every storage device the OS knows about.

Output schema is intentionally identical to DiskutilAdapter.get_all_disks()
and LsblkAdapter.get_all_disks() so the rest of the pipeline is unchanged.
"""

from __future__ import annotations

import json
import logging
import subprocess
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# PowerShell helper
# ---------------------------------------------------------------------------

_PS_SCRIPT = r"""
Set-StrictMode -Off
$ErrorActionPreference = 'SilentlyContinue'
$WarningPreference     = 'SilentlyContinue'

$result = [System.Collections.Generic.List[object]]::new()

# ── Section 1: Physical disks via Get-Disk / Get-Partition / Get-Volume ──────
try {
    $disks = Get-Disk -ErrorAction SilentlyContinue
    if ($disks) {
        foreach ($disk in $disks) {
            try {
                $diskNum = $disk.Number
                $busType = if ($disk.BusType) { "$($disk.BusType)" } else { 'Unknown' }

                $partitions = @(Get-Partition -DiskNumber $diskNum -ErrorAction SilentlyContinue)
                $partList = [System.Collections.Generic.List[object]]::new()

                foreach ($part in $partitions) {
                    try {
                        $vol = $null
                        try { $vol = Get-Volume -Partition $part -ErrorAction SilentlyContinue } catch {}

                        $driveLetter = $null
                        if ($part.DriveLetter -and "$($part.DriveLetter)" -ne "`0" -and "$($part.DriveLetter)" -ne "") {
                            $driveLetter = "$($part.DriveLetter):\"
                        }
                        $partList.Add(@{
                            partition_path       = "\\.\PHYSICALDRIVE$($diskNum)p$($part.PartitionNumber)"
                            partition_number     = "$($part.PartitionNumber)"
                            partition_size       = [int64]$part.Size
                            partition_filesystem = if ($vol) { "$($vol.FileSystemType)" } else { $null }
                            partition_uuid       = if ($vol) { "$($vol.UniqueId)" } else { $null }
                            partition_label      = if ($vol) { "$($vol.FileSystemLabel)" } else { $null }
                            mount_point          = $driveLetter
                        })
                    } catch {}
                }

                $friendly = if ($disk.FriendlyName) { "$($disk.FriendlyName)" } else { 'Unknown Disk' }
                $pname = $friendly -split ' ', 2
                $vendor = if ($pname.Count -gt 0 -and $pname[0]) { $pname[0] } else { 'Unknown' }
                $model  = if ($pname.Count -gt 1 -and $pname[1]) { $pname[1] } else { $friendly }

                $result.Add(@{
                    device_path    = "\\.\PHYSICALDRIVE$diskNum"
                    kernel_name    = "PHYSICALDRIVE$diskNum"
                    vendor         = $vendor
                    model          = $model
                    serial         = if ($disk.SerialNumber) { "$($disk.SerialNumber)".Trim() } else { $null }
                    size_bytes     = [int64]$disk.Size
                    bus            = $busType
                    is_usb         = ($busType -eq 'USB')
                    is_removable   = (-not [bool]$disk.IsSystem)
                    is_system_disk = [bool]$disk.IsSystem
                    is_read_only   = [bool]$disk.IsReadOnly
                    device_type    = if ($busType -eq 'USB') { 'USB_STORAGE' } elseif ([bool]$disk.IsSystem) { 'INTERNAL_STORAGE' } else { $busType.ToUpper() }
                    partitions     = $partList.ToArray()
                })
            } catch {}
        }
    }
} catch {}

# ── Section 2: Accessible volumes (drive letters C:\, D:\, etc.) ─────────────
try {
    $vols = @(Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter -and $_.DriveType -in @('Fixed','Removable') })
    foreach ($v in $vols) {
        try {
            $dl      = "$($v.DriveLetter):\"
            $isSys   = ($v.DriveLetter -eq 'C' -or ($v.FileSystemLabel -and $v.FileSystemLabel -imatch 'os|boot|system'))
            $lbl     = if ($v.FileSystemLabel) { "$($v.FileSystemLabel) ($($v.DriveLetter):)" } else { "Volume ($($v.DriveLetter):)" }
            $devType = if ($v.DriveType -eq 'Removable') { 'USB_STORAGE' } else { 'INTERNAL_STORAGE' }
            $vendorN = if ($isSys) { 'Internal Machine (System)' } elseif ($v.DriveType -eq 'Removable') { 'Removable USB / Flash Drive' } else { 'Internal Storage' }

            $result.Add(@{
                device_path    = $dl
                kernel_name    = "Volume-$($v.DriveLetter)"
                vendor         = $vendorN
                model          = $lbl
                serial         = if ($v.UniqueId) { "$($v.UniqueId)" } else { $null }
                size_bytes     = [int64]$v.Size
                bus            = if ($v.DriveType -eq 'Removable') { 'usb' } else { 'nvme' }
                is_usb         = ($v.DriveType -eq 'Removable')
                is_removable   = ($v.DriveType -eq 'Removable')
                is_system_disk = [bool]$isSys
                is_read_only   = [bool]$isSys
                device_type    = $devType
                filesystem     = if ($v.FileSystemType) { "$($v.FileSystemType)" } else { $null }
                partitions     = @(@{
                    partition_path       = $dl
                    partition_number     = '1'
                    partition_size       = [int64]$v.Size
                    partition_filesystem = if ($v.FileSystemType) { "$($v.FileSystemType)" } else { $null }
                    partition_uuid       = if ($v.UniqueId) { "$($v.UniqueId)" } else { $null }
                    partition_label      = if ($v.FileSystemLabel) { "$($v.FileSystemLabel)" } else { $null }
                    mount_point          = $dl
                })
            })
        } catch {}
    }
} catch {}

# ── Section 3: WPD / MTP mobile devices ─────────────────────────────────────
try {
    $excludePattern = 'echo|kindle|fire\s*hd|fire\s*7|fire\s*10|alexa|firetv|fire\s*tv|ring|blink|amazon\s*echo|amazon\s*alexa'
    $wpdList = @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object {
        ($_.Class -in @('WPD','Portable Device') -or $_.InstanceId -like 'USB\VID_*') -and
        $_.FriendlyName -and
        (-not ($_.FriendlyName -imatch $excludePattern))
    })
    foreach ($wpd in $wpdList) {
        try {
            $friendly = if ($wpd.FriendlyName) { "$($wpd.FriendlyName)" } else { 'Mobile Device' }
            $pname = $friendly -split ' ', 2
            $vendor = if ($pname.Count -gt 0) { $pname[0] } else { 'Mobile' }
            $model  = if ($pname.Count -gt 1) { $pname[1] } else { $friendly }
            $wpdPath = "\\.\WPD\$($wpd.InstanceId)"
            $result.Add(@{
                device_path    = $wpdPath
                kernel_name    = "$($wpd.InstanceId)"
                vendor         = $vendor
                model          = $model
                serial         = "$($wpd.InstanceId)"
                size_bytes     = [int64]0
                bus            = 'usb'
                is_usb         = $true
                is_removable   = $true
                is_system_disk = $false
                is_read_only   = $false
                device_type    = 'MOBILE_DEVICE'
                filesystem     = 'MTP'
                partitions     = @(@{
                    partition_path       = "$wpdPath\Storage"
                    partition_number     = '1'
                    partition_size       = [int64]0
                    partition_filesystem = 'MTP'
                    partition_uuid       = $null
                    partition_label      = 'Phone Storage'
                    mount_point          = $wpdPath
                })
            })
        } catch {}
    }

    # Shell.Application COM fallback (wrapped — fails on some restricted machines)
    if ($wpdList.Count -eq 0) {
        try {
            $sh = New-Object -ComObject Shell.Application -ErrorAction Stop
            $thisPc = $sh.NameSpace(17)
            if ($thisPc) {
                foreach ($item in $thisPc.Items()) {
                    try {
                        if ($item.Type -like '*Portable*' -and (-not ($item.Name -imatch $excludePattern))) {
                            $fName = "$($item.Name)"
                            $pn = $fName -split ' ', 2
                            $result.Add(@{
                                device_path    = "\\.\WPD\$($item.Path)"
                                kernel_name    = "$($item.Path)"
                                vendor         = if ($pn.Count -gt 0) { $pn[0] } else { 'Mobile' }
                                model          = if ($pn.Count -gt 1) { $pn[1] } else { $fName }
                                serial         = "$($item.Path)"
                                size_bytes     = [int64]0
                                bus            = 'usb'
                                is_usb         = $true
                                is_removable   = $true
                                is_system_disk = $false
                                is_read_only   = $false
                                device_type    = 'MOBILE_DEVICE'
                                filesystem     = 'MTP'
                                partitions     = @(@{
                                    partition_path       = "\\.\WPD\$($item.Path)\Storage"
                                    partition_number     = '1'
                                    partition_size       = [int64]0
                                    partition_filesystem = 'MTP'
                                    partition_uuid       = $null
                                    partition_label      = 'Phone Storage'
                                    mount_point          = "\\.\WPD\$($item.Path)"
                                })
                            })
                        }
                    } catch {}
                }
            }
        } catch {}
    }
} catch {}

if ($result.Count -eq 0) { '[]' } else { $result | ConvertTo-Json -Depth 5 -Compress }
"""


def _run_powershell(script: str) -> Any:
    """Run a PowerShell script and return the parsed JSON output.

    Uses -ExecutionPolicy Bypass so the script works on machines with
    Restricted / AllSigned execution policies (common on lab machines).
    Errors from individual enumeration sections are swallowed inside the
    script itself; we only raise here if PowerShell fails to start at all.
    """
    result = subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy", "Bypass",
            "-Command", script,
        ],
        capture_output=True,
        text=True,
        timeout=20,
    )
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()

    # A non-zero exit is only fatal if we also got no usable stdout.
    # PowerShell writes non-fatal warnings to stderr but still exits 0;
    # however on some machines it exits 1 even when data was produced.
    if result.returncode != 0 and not stdout:
        raise RuntimeError(
            f"PowerShell exited {result.returncode}: {stderr}"
        )

    if not stdout or stdout == "[]":
        return []

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as exc:
        logger.warning("WindowsStorageAdapter: JSON parse failed (%s). stderr: %s", exc, stderr[:300])
        return []



# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _str(value: object) -> str:
    if value is None:
        return "Unknown"
    return str(value).strip() or "Unknown"


def _norm_partition(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalise a partition dict from PowerShell to the standard schema."""
    return {
        "partition_path": raw.get("partition_path") or "",
        "partition_number": str(raw.get("partition_number") or "1"),
        "partition_size": int(raw.get("partition_size") or 0),
        "partition_filesystem": raw.get("partition_filesystem") or None,
        "partition_uuid": raw.get("partition_uuid") or None,
        "partition_label": raw.get("partition_label") or None,
        "mount_point": raw.get("mount_point") or None,
    }


def _norm_disk(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalise a disk dict from PowerShell to the standard schema."""
    raw_parts = raw.get("partitions") or []
    # PowerShell may return a single dict instead of a list when there is one partition
    if isinstance(raw_parts, dict):
        raw_parts = [raw_parts]
    partitions = [_norm_partition(p) for p in raw_parts]

    # Preserve the real bus type from PowerShell (USB / SATA / NVMe / SCSI / MMC / …)
    raw_bus = str(raw.get("bus") or "Unknown").strip()
    return {
        "device_path": raw.get("device_path") or r"\\.\PHYSICALDRIVE0",
        "kernel_name": raw.get("kernel_name") or "PHYSICALDRIVE0",
        "vendor": _str(raw.get("vendor")),
        "model": _str(raw.get("model")),
        "serial": raw.get("serial") or None,
        "size_bytes": int(raw.get("size_bytes") or 0),
        "bus": raw_bus.lower(),
        "is_usb": raw_bus.upper() == "USB",
        "is_removable": bool(raw.get("is_removable", True)),
        "is_system_disk": bool(raw.get("is_system_disk", False)),
        "is_read_only": bool(raw.get("is_read_only", False)),
        "device_type": raw.get("device_type") or None,
        "partitions": partitions,
    }


# ---------------------------------------------------------------------------
# Public adapter class
# ---------------------------------------------------------------------------

class WindowsStorageAdapter:
    """Windows adapter that discovers ALL physical storage devices via PowerShell.

    Covers USB drives, SATA/NVMe SSDs, SD cards, Thunderbolt enclosures, etc.
    """

    @staticmethod
    def get_all_disks() -> list[dict[str, Any]]:
        """Return normalised physical disks visible on this Windows machine."""
        try:
            raw = _run_powershell(_PS_SCRIPT)
        except Exception as exc:
            logger.error("WindowsStorageAdapter: PowerShell enumeration failed: %s", exc)
            return []

        if not raw:
            return []

        # PowerShell returns a list; if only one disk it may be a bare dict
        if isinstance(raw, dict):
            raw = [raw]

        devices: list[dict[str, Any]] = []
        for item in raw:
            try:
                devices.append(_norm_disk(item))
            except Exception as exc:  # noqa: BLE001
                logger.warning("WindowsStorageAdapter: skipping malformed disk entry: %s", exc)

        logger.info("WindowsStorageAdapter: found %d disk(s)", len(devices))
        return devices


# Backward-compat alias
WindowsUsbAdapter = WindowsStorageAdapter
