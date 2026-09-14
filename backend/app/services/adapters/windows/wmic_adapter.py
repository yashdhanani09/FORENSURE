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
$ErrorActionPreference = 'SilentlyContinue'

# Enumerate ALL physical disks — no bus-type filter
$disks = Get-Disk

$result = @()

foreach ($disk in $disks) {
    $diskNum = $disk.Number
    $busType = $disk.BusType  # USB / SATA / NVMe / SCSI / MMC / etc.

    # Partitions on this disk
    $partitions = Get-Partition -DiskNumber $diskNum -ErrorAction SilentlyContinue

    $partList = @()
    foreach ($part in $partitions) {
        $vol = $null
        try {
            $vol = Get-Volume -Partition $part -ErrorAction SilentlyContinue
        } catch {}

        $driveLetter = $null
        if ($part.DriveLetter -and $part.DriveLetter -ne "`0") {
            $driveLetter = "$($part.DriveLetter):\"
        }

        $partList += @{
            partition_path       = "\\.\PHYSICALDRIVE$($diskNum)p$($part.PartitionNumber)"
            partition_number     = "$($part.PartitionNumber)"
            partition_size       = [int64]$part.Size
            partition_filesystem = if ($vol) { $vol.FileSystemType } else { $null }
            partition_uuid       = if ($vol) { $vol.UniqueId } else { $null }
            partition_label      = if ($vol) { $vol.FileSystemLabel } else { $null }
            mount_point          = $driveLetter
        }
    }

    # Try to extract vendor/model from FriendlyName (e.g. "SanDisk Ultra USB 3.0")
    $friendly = $disk.FriendlyName
    $parts_name = $friendly -split ' ', 2
    $vendor = if ($parts_name.Count -gt 0) { $parts_name[0] } else { 'Unknown' }
    $model  = if ($parts_name.Count -gt 1) { $parts_name[1] } else { $friendly }

    $result += @{
        device_path    = "\\.\PHYSICALDRIVE$diskNum"
        kernel_name    = "PHYSICALDRIVE$diskNum"
        vendor         = $vendor
        model          = $model
        serial         = $disk.SerialNumber
        size_bytes     = [int64]$disk.Size
        bus            = $busType
        is_usb         = ($busType -eq 'USB')
        is_removable   = (-not $disk.IsSystem)
        is_system_disk = [bool]$disk.IsSystem
        is_read_only   = [bool]$disk.IsReadOnly
        device_type    = if ($busType -eq 'USB') { 'USB_STORAGE' } elseif ($disk.IsSystem) { 'INTERNAL_STORAGE' } else { $busType.ToUpper() }
        partitions     = $partList
    }
}

# Enumerate accessible storage volumes (Internal C:\, D:\, external drives)
$vols = Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -in @('Fixed', 'Removable') }
foreach ($v in $vols) {
    $dl = ('{0}:\' -f $v.DriveLetter)
    $isSys = ($v.DriveLetter -eq 'C' -or ($v.FileSystemLabel -and $v.FileSystemLabel -imatch 'os|boot|system'))
    $lbl = if ($v.FileSystemLabel) { ('{0} ({1}:)' -f $v.FileSystemLabel, $v.DriveLetter) } else { ('Volume ({0}:)' -f $v.DriveLetter) }
    $devType = if ($v.DriveType -eq 'Removable') { 'USB_STORAGE' } else { 'INTERNAL_STORAGE' }
    $vendorName = if ($isSys) { 'Internal Machine (System)' } elseif ($v.DriveType -eq 'Removable') { 'Removable USB / Flash Drive' } else { 'Internal Storage' }
    $result += @{
        device_path    = $dl
        kernel_name    = ('Volume-{0}' -f $v.DriveLetter)
        vendor         = $vendorName
        model          = $lbl
        serial         = $v.UniqueId
        size_bytes     = [int64]$v.Size
        bus            = if ($v.DriveType -eq 'Removable') { 'usb' } else { 'nvme' }
        is_usb         = ($v.DriveType -eq 'Removable')
        is_removable   = ($v.DriveType -eq 'Removable')
        is_system_disk = [bool]$isSys
        is_read_only   = [bool]$isSys
        device_type    = $devType
        filesystem     = $v.FileSystemType
        partitions     = @(@{
            partition_path       = $dl
            partition_number     = '1'
            partition_size       = [int64]$v.Size
            partition_filesystem = $v.FileSystemType
            partition_uuid       = $v.UniqueId
            partition_label      = $v.FileSystemLabel
            mount_point          = $dl
        })
    }
}

# Enumerate connected mobile devices (WPD / MTP / Android / iPhone / Windows Portable Devices)
$excludePattern = 'echo|kindle|fire\s*hd|fire\s*7|fire\s*10|alexa|firetv|fire\s*tv|ring|blink|amazon\s*echo|amazon\s*alexa'

$wpdList = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object {
    ($_.Class -in @('WPD', 'Portable Device') -or $_.InstanceId -like 'USB\VID_*') -and
    $_.FriendlyName -and
    (-not ($_.FriendlyName -imatch $excludePattern))
}

# Cross-reference with Shell.Application namespace 17 (This PC portable devices)
$sh = New-Object -ComObject Shell.Application
$thisPc = $sh.NameSpace(17)
$knownWpdNames = @($wpdList | ForEach-Object { $_.FriendlyName })

foreach ($wpd in $wpdList) {
    $friendly = if ($wpd.FriendlyName) { $wpd.FriendlyName } else { 'Mobile Device' }
    $parts_name = $friendly -split ' ', 2
    $vendor = if ($parts_name.Count -gt 0) { $parts_name[0] } else { 'Mobile' }
    $model  = if ($parts_name.Count -gt 1) { $parts_name[1] } else { $friendly }
    $wpdPath = ('\\.\WPD\{0}' -f $wpd.InstanceId)
    $result += @{
        device_path    = $wpdPath
        kernel_name    = $wpd.InstanceId
        vendor         = $vendor
        model          = $model
        serial         = $wpd.InstanceId
        size_bytes     = [int64]0
        bus            = 'usb'
        is_usb         = $true
        is_removable   = $true
        is_system_disk = $false
        is_read_only   = $false
        device_type    = 'MOBILE_DEVICE'
        filesystem     = 'MTP'
        partitions     = @(@{
            partition_path       = ('{0}\Storage' -f $wpdPath)
            partition_number     = '1'
            partition_size       = [int64]0
            partition_filesystem = 'MTP'
            partition_uuid       = $null
            partition_label      = 'Phone Storage'
            mount_point          = $wpdPath
        })
    }
}

# Fallback: Check Shell COM items if no WPD device was registered
if ($wpdList.Count -eq 0 -and $thisPc) {
    foreach ($item in $thisPc.Items()) {
        if ($item.Type -like "*Portable*" -and (-not ($item.Name -imatch $excludePattern))) {
            $fName = $item.Name
            $p_name = $fName -split ' ', 2
            $v_name = if ($p_name.Count -gt 0) { $p_name[0] } else { 'Mobile' }
            $m_name = if ($p_name.Count -gt 1) { $p_name[1] } else { $fName }
            $result += @{
                device_path    = "\\.\WPD\$($item.Path)"
                kernel_name    = $item.Path
                vendor         = $v_name
                model          = $m_name
                serial         = $item.Path
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
            }
        }
    }
}

$result | ConvertTo-Json -Depth 5
"""


def _run_powershell(script: str) -> Any:
    """Run a PowerShell script and return the parsed JSON output."""
    result = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
        capture_output=True,
        text=True,
        timeout=15,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"PowerShell exited {result.returncode}: {result.stderr.strip()}"
        )
    stdout = result.stdout.strip()
    if not stdout:
        return []
    return json.loads(stdout)


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
