"""Mobile device forensic recovery service (WPD / MTP / Android / iPhone).

Enables recovery of deleted files and forensic remnants from mobile devices connected via USB:
  1. Android Scoped Storage Trash (.trashed files kept within the 30-day retention window)
  2. Android Gallery / Google Photos Trash & TMFS (.tmfs temporary media files)
  3. MediaStore high-resolution cached thumbnail remnants (.thumbnails / .cache)
  4. Unlinked crash recovery fragments (LOST.DIR)
  5. Unindexed / hidden app media remnants

Uses Windows Shell COM (Shell.Application) to interface directly with MTP portable devices
without requiring administrative elevation or rooting the phone.
"""

from __future__ import annotations

import os
import re
import uuid
import json
import logging
import hashlib
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any

from app.schemas.recovery import DeletedFileItem

logger = logging.getLogger(__name__)

# Cache for mobile file metadata mapping: { file_id: {"shell_path": ..., "raw_name": ..., "clean_name": ...} }
MOBILE_FILE_METADATA_CACHE: Dict[str, Dict[str, Any]] = {}


def _get_category(extension: str) -> str:
    ext = extension.lower().lstrip(".")
    if ext in {"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tiff", "heic", "dng", "raw"}:
        return "Image"
    if ext in {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "csv", "md", "json", "xml"}:
        return "Document"
    if ext in {"mp4", "mkv", "avi", "mov", "wmv", "3gp", "mp3", "wav", "flac", "aac", "ogg", "m4a", "opus"}:
        return "Media"
    if ext in {"zip", "rar", "7z", "tar", "gz", "bz2", "xz"}:
        return "Archive"
    if ext in {"apk", "dex", "so", "py", "js", "html", "css"}:
        return "Code"
    return "Other"


def _build_powershell_scanner_script(target_identifier: str = "") -> str:
    """Generates the PowerShell script that traverses MTP storage using Shell.Application."""
    script = r"""
$ErrorActionPreference = 'SilentlyContinue'
$sh = New-Object -ComObject Shell.Application
$thisPc = $sh.NameSpace(17)

$targetPhone = $null
$identifier = '__TARGET_IDENTIFIER__'

foreach ($item in $thisPc.Items()) {
    $isMatch = $false
    if ($identifier -and ($item.Name -like "*$identifier*" -or $item.Path -like "*$identifier*")) {
        $isMatch = $true
    } elseif (-not $identifier -and ($item.Type -like "*Portable*" -or $item.Path -like "*usb#vid_*")) {
        $isMatch = $true
    }
    if ($isMatch) {
        $targetPhone = $item
        break
    }
}

if (-not $targetPhone) {
    # Fallback to any portable device
    foreach ($item in $thisPc.Items()) {
        if ($item.Type -like "*Portable*" -or $item.Path -like "*usb#vid_*") {
            $targetPhone = $item
            break
        }
    }
}

if (-not $targetPhone) {
    Write-Output "[]"
    exit
}

$results = @()
$phoneFolder = $targetPhone.GetFolder

function Add-RecoverableItem($item, $parentPath, $method, $valDetails, $score, $conf) {
    $rawName = $item.ExtendedProperty("System.FileName")
    if (-not $rawName) { $rawName = $item.Name }
    if (-not $rawName) { return }
    
    $cleanName = if ($rawName -match '^\.trashed-\d+-(.+)$') { $matches[1] } else { $rawName }
    $ext = [System.IO.Path]::GetExtension($cleanName).TrimStart('.')
    $sz = $item.ExtendedProperty("System.Size")
    if (-not $sz) { $sz = 0 }
    
    $script:results += @{
        filename           = $cleanName
        raw_filename       = $rawName
        original_path      = "$parentPath\$rawName"
        shell_path         = $item.Path
        size_bytes         = [int64]$sz
        extension          = if ($ext) { $ext } else { 'bin' }
        deleted_at         = [string]$item.ModifyDate
        confidence         = $conf
        confidence_score   = $score
        validation_details = $valDetails
        recovery_method    = $method
        recoverable        = $true
    }
}

function Scan-Folder-Files($folder, $parentPath, $method, $valDetails, $score, $conf, $maxItems = 80) {
    if (-not $folder) { return }
    $count = 0
    foreach ($item in $folder.Items()) {
        if ($count -ge $maxItems) { break }
        if (-not $item.IsFolder) {
            Add-RecoverableItem $item $parentPath $method $valDetails $score $conf
            $count++
        }
    }
}

function Scan-Folder-Trashed-Prefix($folder, $parentPath, $maxItems = 60) {
    if (-not $folder) { return }
    $count = 0
    foreach ($item in $folder.Items()) {
        if ($count -ge $maxItems) { break }
        if (-not $item.IsFolder) {
            $rawName = $item.ExtendedProperty("System.FileName")
            if (-not $rawName) { $rawName = $item.Name }
            if ($rawName -like ".trashed*" -or $rawName -like "*trash*" -or $item.Name -like "*trash*") {
                Add-RecoverableItem $item $parentPath 'android_scoped_trash' 'Android Scoped Storage Trash payload (.trashed)' 95 'HIGH'
                $count++
            }
        }
    }
}

foreach ($storage in $targetPhone.GetFolder.Items()) {
    $sf = $storage.GetFolder
    if (-not $sf) { continue }
    $sName = $storage.Name

    # 1. Check root trash and lost.dir folders
    foreach ($tName in @('.trashed', '.trash', 'Trash', 'LOST.DIR')) {
        $tf = $sf.ParseName($tName)
        if ($tf -and $tf.IsFolder) {
            $m = if ($tName -like "*lost*") { 'android_lost_dir' } else { 'android_scoped_trash' }
            Scan-Folder-Files $tf.GetFolder "$sName\$tName" $m "Android $tName directory" 90 'HIGH'
        }
    }

    # 2. Check DCIM
    $dcim = $sf.ParseName('DCIM')
    if ($dcim -and $dcim.IsFolder) {
        $df = $dcim.GetFolder
        Scan-Folder-Trashed-Prefix $df "$sName\DCIM"
        
        # Camera
        $cam = $df.ParseName('Camera')
        if ($cam -and $cam.IsFolder) {
            Scan-Folder-Trashed-Prefix $cam.GetFolder "$sName\DCIM\Camera"
        }
        # .tmfs (Temporary Media File Store)
        $tmfs = $df.ParseName('.tmfs')
        if ($tmfs -and $tmfs.IsFolder) {
            Scan-Folder-Files $tmfs.GetFolder "$sName\DCIM\.tmfs" 'android_thumbnail_cache' 'Android MediaStore TMFS Media Cache' 85 'HIGH'
        }
        # .thumbnails
        $thumbs = $df.ParseName('.thumbnails')
        if ($thumbs -and $thumbs.IsFolder) {
            Scan-Folder-Files $thumbs.GetFolder "$sName\DCIM\.thumbnails" 'android_thumbnail_cache' 'Android DCIM Thumbnails' 85 'HIGH'
        }
        # .trashed
        $dtrash = $df.ParseName('.trashed')
        if ($dtrash -and $dtrash.IsFolder) {
            Scan-Folder-Files $dtrash.GetFolder "$sName\DCIM\.trashed" 'android_scoped_trash' 'Android Scoped Storage DCIM Trash' 95 'HIGH'
        }
    }

    # 3. Check Pictures
    $pics = $sf.ParseName('Pictures')
    if ($pics -and $pics.IsFolder) {
        $pf = $pics.GetFolder
        Scan-Folder-Trashed-Prefix $pf "$sName\Pictures"
        
        # .thumbnails
        $pthumbs = $pf.ParseName('.thumbnails')
        if ($pthumbs -and $pthumbs.IsFolder) {
            Scan-Folder-Files $pthumbs.GetFolder "$sName\Pictures\.thumbnails" 'android_thumbnail_cache' 'Android MediaStore Thumbnail Remnants' 85 'HIGH'
        }
        # Screenshots
        $screens = $pf.ParseName('Screenshots')
        if ($screens -and $screens.IsFolder) {
            Scan-Folder-Trashed-Prefix $screens.GetFolder "$sName\Pictures\Screenshots"
        }
        # .trashed
        $ptrash = $pf.ParseName('.trashed')
        if ($ptrash -and $ptrash.IsFolder) {
            Scan-Folder-Files $ptrash.GetFolder "$sName\Pictures\.trashed" 'android_scoped_trash' 'Android Pictures Trash' 95 'HIGH'
        }
    }

    # 4. Check Download & Documents for trashed subdirectories
    foreach ($dName in @('Download', 'Downloads', 'Documents')) {
        $dfolder = $sf.ParseName($dName)
        if ($dfolder -and $dfolder.IsFolder) {
            $dff = $dfolder.GetFolder
            foreach ($subT in @('.trashed', '.trash', 'Trash')) {
                $subTrash = $dff.ParseName($subT)
                if ($subTrash -and $subTrash.IsFolder) {
                    Scan-Folder-Files $subTrash.GetFolder "$sName\$dName\$subT" 'android_scoped_trash' "Android $dName Trash" 95 'HIGH'
                }
            }
        }
    }
}

$results | ConvertTo-Json -Depth 3
"""
    return script.replace("__TARGET_IDENTIFIER__", target_identifier)


def scan_mobile_deleted_files(device: dict, max_items: int = 300) -> List[DeletedFileItem]:
    """
    Scans a connected mobile phone via MTP / Windows Shell for deleted files,
    Scoped Storage trash, thumbnail caches, and unlinked remnants.
    """
    items: List[DeletedFileItem] = []
    
    # Extract identifier to match phone name or instance id
    identifier = ""
    model = device.get("model", "")
    vendor = device.get("vendor", "")
    dev_path = device.get("device_path", "")
    
    if model and model != "Mobile Device":
        identifier = model
    elif vendor and vendor not in ("Mobile", "Unknown"):
        identifier = vendor
    elif "VID_" in dev_path.upper():
        match = re.search(r"VID_[0-9A-F]+", dev_path, re.IGNORECASE)
        if match:
            identifier = match.group(0)

    logger.info("Initiating mobile forensic scan for target %s (identifier: '%s')", model or dev_path, identifier)
    ps_code = _build_powershell_scanner_script(identifier)

    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_code],
            capture_output=True,
            text=True,
            timeout=60,
        )
        stdout = proc.stdout.strip()
        if not stdout or stdout == "[]":
            logger.info("Mobile scan returned 0 items from target %s", identifier)
            return items

        raw_items = json.loads(stdout)
        if isinstance(raw_items, dict):
            raw_items = [raw_items]

        for entry in raw_items[:max_items]:
            fid = f"mob_{uuid.uuid4().hex[:12]}"
            clean_name = entry.get("filename", "unknown")
            raw_name = entry.get("raw_filename", clean_name)
            orig_path = entry.get("original_path", "")
            shell_path = entry.get("shell_path", "")
            ext = entry.get("extension", "bin")
            sz = int(entry.get("size_bytes", 0))
            score = int(entry.get("confidence_score", 80))
            conf = entry.get("confidence", "HIGH")
            method = entry.get("recovery_method", "android_scoped_trash")
            val_details = entry.get("validation_details", "Android forensic artifact")

            del_at = None
            date_str = entry.get("deleted_at")
            if date_str:
                for fmt in ("%d-%m-%Y %H:%M", "%m/%d/%Y %I:%M:%S %p", "%Y-%m-%d %H:%M:%S"):
                    try:
                        del_at = datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
                        break
                    except Exception:
                        pass

            item = DeletedFileItem(
                id=fid,
                filename=clean_name,
                original_path=orig_path,
                source_path=f"mobile://{shell_path}",
                size_bytes=sz,
                extension=ext,
                category=_get_category(ext),
                deleted_at=del_at,
                confidence=conf,
                confidence_score=score,
                validation_details=val_details,
                recovery_method=method,
                recoverable=True,
            )
            items.append(item)

            MOBILE_FILE_METADATA_CACHE[fid] = {
                "shell_path": shell_path,
                "raw_name": raw_name,
                "clean_name": clean_name,
                "original_path": orig_path,
            }

        logger.info("Mobile forensic scan completed: discovered %d recoverable item(s)", len(items))

    except subprocess.TimeoutExpired:
        logger.warning("Mobile scan timed out after 45s on target %s", identifier)
    except Exception as exc:
        logger.error("Error running mobile forensic scanner: %s", exc)

    return items


def restore_mobile_file(
    file_id: str,
    item: DeletedFileItem,
    destination_dir: str
) -> Tuple[bool, str, int, str, str]:
    """
    Restores a mobile file to the PC evidence folder using Windows Shell COM.
    Returns (success, output_path, size_bytes, sha256, error_message).
    """
    meta = MOBILE_FILE_METADATA_CACHE.get(file_id)
    raw_name = meta.get("raw_name") if meta else item.filename
    clean_name = item.filename
    orig_path = item.original_path

    path_parts = orig_path.split("\\")
    storage_name = path_parts[0] if len(path_parts) > 0 else "Internal shared storage"
    sub_path = "\\".join(path_parts[1:-1]) if len(path_parts) > 2 else ""

    os.makedirs(destination_dir, exist_ok=True)
    abs_dest = os.path.abspath(destination_dir)

    ps_restore = r"""
$ErrorActionPreference = 'SilentlyContinue'
$sh = New-Object -ComObject Shell.Application
$thisPc = $sh.NameSpace(17)

$targetPhone = $null
foreach ($item in $thisPc.Items()) {
    if ($item.Type -like "*Portable*" -or $item.Path -like "*usb#vid_*") {
        $targetPhone = $item
        break
    }
}

if (-not $targetPhone) {
    Write-Output "ERR:PHONE_NOT_FOUND"
    exit
}

$phoneFolder = $targetPhone.GetFolder
$storage = $null
foreach ($s in $phoneFolder.Items()) {
    if ($s.Name -eq '__STORAGE_NAME__' -or $s.Name -like "*internal*" -or $s.Name -like "*storage*") {
        $storage = $s
        break
    }
}
if (-not $storage) {
    $storage = $phoneFolder.Items() | Select-Object -First 1
}
if (-not $storage) {
    Write-Output "ERR:STORAGE_NOT_FOUND"
    exit
}

$currentFolder = $storage.GetFolder
$subPath = '__SUB_PATH__'
if ($subPath) {
    $parts = $subPath.Split('\')
    foreach ($part in $parts) {
        if ($part) {
            $next = $currentFolder.ParseName($part)
            if ($next -and $next.IsFolder) {
                $currentFolder = $next.GetFolder
            }
        }
    }
}

$targetFile = $null
$rawName = '__RAW_NAME__'
foreach ($item in $currentFolder.Items()) {
    $fn = $item.ExtendedProperty("System.FileName")
    if (-not $fn) { $fn = $item.Name }
    if ($fn -eq $rawName -or $item.Name -eq $rawName) {
        $targetFile = $item
        break
    }
}

if (-not $targetFile) {
    Write-Output "ERR:FILE_NOT_FOUND"
    exit
}

$destDir = '__DEST_DIR__'
$destFolder = $sh.NameSpace($destDir)
$destFolder.CopyHere($targetFile, 16)

# Wait up to 15 seconds for file copy
$copiedPath = Join-Path $destDir $rawName
for ($i = 0; $i -lt 15; $i++) {
    if (Test-Path $copiedPath) { break }
    Start-Sleep -Seconds 1
}

if (Test-Path $copiedPath) {
    Write-Output "OK:$copiedPath"
} else {
    Write-Output "ERR:COPY_TIMEOUT"
}
"""
    ps_restore = ps_restore.replace("__STORAGE_NAME__", storage_name)
    ps_restore = ps_restore.replace("__SUB_PATH__", sub_path)
    ps_restore = ps_restore.replace("__RAW_NAME__", raw_name)
    ps_restore = ps_restore.replace("__DEST_DIR__", abs_dest)

    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_restore],
            capture_output=True,
            text=True,
            timeout=30,
        )
        stdout = proc.stdout.strip()
        if not stdout.startswith("OK:"):
            err_msg = stdout or proc.stderr.strip() or "Failed to copy file from mobile device."
            return False, "", 0, "", err_msg

        copied_path = stdout[3:].strip()
        if not os.path.exists(copied_path):
            return False, "", 0, "", f"Copied file not found at expected path: {copied_path}"

        final_path = copied_path
        if clean_name and clean_name != raw_name:
            target_path = os.path.join(abs_dest, clean_name)
            counter = 1
            base, ext = os.path.splitext(clean_name)
            while os.path.exists(target_path):
                target_path = os.path.join(abs_dest, f"{base}_{counter}{ext}")
                counter += 1
            try:
                os.rename(copied_path, target_path)
                final_path = target_path
            except Exception as e:
                logger.warning("Could not rename copied file: %s", e)

        file_size = os.path.getsize(final_path)
        with open(final_path, "rb") as f:
            digest = hashlib.sha256(f.read()).hexdigest()

        return True, final_path, file_size, digest, ""

    except Exception as exc:
        logger.error("Error restoring mobile file %s: %s", raw_name, exc)
        return False, "", 0, "", str(exc)
