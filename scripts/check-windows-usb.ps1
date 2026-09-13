<#
.SYNOPSIS
    SecureData — Windows USB diagnostic helper.
    Equivalent of scripts/check-linux-usb.sh but for Windows.

.DESCRIPTION
    Lists all USB-attached physical disks, their partitions, and mounted volumes
    using the Storage cmdlets (available inbox on Windows 10/11).

    Run from an elevated PowerShell prompt if drive letters are missing.

.EXAMPLE
    .\check-windows-usb.ps1
#>

Write-Host "`n=== USB Physical Disks ===" -ForegroundColor Cyan

$usbDisks = Get-Disk | Where-Object { $_.BusType -eq 'USB' }

if (-not $usbDisks) {
    Write-Warning "No USB disks detected. Make sure a USB drive is connected and recognised by Windows."
    exit 0
}

foreach ($disk in $usbDisks) {
    Write-Host "`nDisk $($disk.Number): $($disk.FriendlyName)" -ForegroundColor Yellow
    Write-Host "  Size         : $([math]::Round($disk.Size / 1GB, 2)) GB"
    Write-Host "  Serial       : $($disk.SerialNumber)"
    Write-Host "  Partition St.: $($disk.PartitionStyle)"
    Write-Host "  IsSystem     : $($disk.IsSystem)"
    Write-Host "  IsReadOnly   : $($disk.IsReadOnly)"
    Write-Host "  HealthStatus : $($disk.HealthStatus)"

    $partitions = Get-Partition -DiskNumber $disk.Number -ErrorAction SilentlyContinue
    if ($partitions) {
        Write-Host "  Partitions:" -ForegroundColor Green
        foreach ($part in $partitions) {
            $vol = $null
            try { $vol = Get-Volume -Partition $part -ErrorAction Stop } catch {}

            $letter = if ($part.DriveLetter -and $part.DriveLetter -ne "`0") {
                "$($part.DriveLetter):\"
            } else { "(no drive letter)" }

            $fs     = if ($vol) { $vol.FileSystemType } else { "unknown" }
            $label  = if ($vol) { $vol.FileSystemLabel } else { "" }
            $sizeGB = [math]::Round($part.Size / 1GB, 2)

            Write-Host ("    Partition {0}: {1}  fs={2}  label={3}  size={4} GB" -f
                $part.PartitionNumber, $letter, $fs, $label, $sizeGB)
        }
    } else {
        Write-Host "  (no partitions found)" -ForegroundColor DarkGray
    }
}

Write-Host "`n=== Raw WMI Check ===" -ForegroundColor Cyan
Get-WmiObject Win32_DiskDrive |
    Where-Object { $_.InterfaceType -eq 'USB' } |
    Select-Object DeviceID, Model, SerialNumber, Size |
    Format-Table -AutoSize
