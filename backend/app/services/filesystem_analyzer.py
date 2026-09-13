"""Read-only, mount-aware filesystem analysis and directory browsing."""

from __future__ import annotations

from datetime import UTC, datetime
import os
from pathlib import Path, PurePosixPath
import shutil
import stat as _stat
from typing import Literal

from app.schemas.device import DeviceAnalysis, FileBrowserResponse, FileEntry
from app.services.usb_detector import UsbDeviceRecord

MAX_INVENTORY_ENTRIES = 100_000


class FileBrowserError(ValueError):
    """A safe browsing problem which never exposes a host path."""



def _normalise_relative_path(raw_path: str) -> str:
    path = PurePosixPath(raw_path or ".")
    if path.is_absolute() or ".." in path.parts:
        raise FileBrowserError("The requested folder is not available on this USB device.")
    return "/".join(part for part in path.parts if part not in ("", "."))


def _datetime(timestamp: float | None) -> datetime | None:
    return datetime.fromtimestamp(timestamp, tz=UTC) if timestamp is not None else None


def _entry_from_dirent(entry: os.DirEntry[str], parent_path: str) -> FileEntry | None:
    try:
        stat = entry.stat(follow_symlinks=False)
        if entry.is_symlink():
            kind: Literal["file", "directory", "symlink", "other"] = "symlink"
        elif entry.is_dir(follow_symlinks=False):
            kind = "directory"
        elif entry.is_file(follow_symlinks=False):
            kind = "file"
        else:
            kind = "other"
        relative = f"{parent_path}/{entry.name}" if parent_path else entry.name
        # Linux ctime is a metadata-change timestamp, not a creation date.
        birthtime = getattr(stat, "st_birthtime", None)
        # On Windows use the FILE_ATTRIBUTE_HIDDEN flag; fall back to dot-prefix on other OSes.
        _win_hidden_attr = getattr(_stat, "FILE_ATTRIBUTE_HIDDEN", None)
        if _win_hidden_attr is not None:
            _file_attrs = getattr(stat, "st_file_attributes", 0)
            hidden = bool(_file_attrs & _win_hidden_attr)
        else:
            hidden = entry.name.startswith(".")
        return FileEntry(
            name=entry.name,
            path=relative,
            parent_path=parent_path,
            kind=kind,
            size_bytes=stat.st_size if kind == "file" else None,
            modified_at=_datetime(stat.st_mtime),
            created_at=_datetime(birthtime),
            accessed_at=_datetime(stat.st_atime),
            extension=Path(entry.name).suffix.removeprefix(".").lower() if kind == "file" else None,
            hidden=hidden,
        )
    except OSError:
        return None


def _sort_entries(entries: list[FileEntry], sort_by: str, sort_order: str) -> list[FileEntry]:
    reverse = sort_order == "desc"
    if sort_by == "size":
        key = lambda item: (item.kind != "directory", item.size_bytes or 0, item.name.lower())
    elif sort_by == "modified":
        key = lambda item: (item.kind != "directory", item.modified_at or datetime.min.replace(tzinfo=UTC), item.name.lower())
    elif sort_by == "type":
        key = lambda item: (item.kind != "directory", item.kind, item.name.lower())
    else:
        key = lambda item: (item.kind != "directory", item.name.lower())
    return sorted(entries, key=key, reverse=reverse)


def browse_files(
    record: UsbDeviceRecord,
    *,
    path: str = "",
    search: str = "",
    kind: Literal["all", "file", "directory"] = "all",
    sort_by: Literal["name", "size", "modified", "type"] = "name",
    sort_order: Literal["asc", "desc"] = "asc",
    offset: int = 0,
    limit: int = 200,
) -> FileBrowserResponse:
    current_path = _normalise_relative_path(path)
    parent_path = "/".join(current_path.split("/")[:-1]) or None if current_path else None
    if not record.mount_point:
        return FileBrowserResponse(device_id=record.id, current_path=current_path, parent_path=parent_path, status="unavailable", message="Mount the USB through the operating system before browsing its files.")
    try:
        mount_root = Path(record.mount_point).resolve(strict=True)
        candidate = (mount_root / current_path).resolve(strict=True)
        candidate.relative_to(mount_root)
        if not candidate.is_dir():
            return FileBrowserResponse(device_id=record.id, current_path=current_path, parent_path=parent_path, status="not_found", message="The requested folder is not available on this USB device.")
        with os.scandir(candidate) as directory:
            entries = [item for child in directory if (item := _entry_from_dirent(child, current_path)) is not None]
    except (OSError, ValueError):
        return FileBrowserResponse(device_id=record.id, current_path=current_path, parent_path=parent_path, status="unavailable", message="The USB filesystem could not be read. Check its mount state and permissions.")

    needle = search.strip().lower()
    if needle:
        entries = [entry for entry in entries if needle in entry.name.lower()]
    if kind != "all":
        entries = [entry for entry in entries if entry.kind == kind]
    ordered = _sort_entries(entries, sort_by, sort_order)
    return FileBrowserResponse(
        device_id=record.id,
        current_path=current_path,
        parent_path=parent_path,
        entries=ordered[offset : offset + limit],
        total=len(ordered),
        status="completed",
        message="Folder metadata listed without opening source files.",
    )


def preview_file(record: UsbDeviceRecord, path: str) -> dict[str, str]:
    current_path = _normalise_relative_path(path)
    if not record.mount_point:
        raise FileBrowserError("Mount the USB through the operating system before previewing files.")
    try:
        mount_root = Path(record.mount_point).resolve(strict=True)
        candidate = (mount_root / current_path).resolve(strict=True)
        candidate.relative_to(mount_root)
        if not candidate.is_file():
            raise FileBrowserError("The requested path is not a file.")
        with open(candidate, "rb") as f:
            data = f.read(4096)
        try:
            text = data.decode("utf-8")
            return {"content": text, "type": "text/plain"}
        except UnicodeDecodeError:
            import binascii
            return {"content": binascii.hexlify(data).decode("ascii"), "type": "application/octet-stream"}
    except (OSError, ValueError):
        raise FileBrowserError("The file could not be read. Check its permissions.")


def _count_tree(mount: Path) -> tuple[int, int, dict[str, int], bool]:
    files = directories = examined = 0
    extension_counts: dict[str, int] = {}
    stack = [mount]
    while stack and examined < MAX_INVENTORY_ENTRIES:
        directory = stack.pop()
        try:
            with os.scandir(directory) as children:
                for child in children:
                    if examined >= MAX_INVENTORY_ENTRIES:
                        break
                    examined += 1
                    try:
                        if child.is_dir(follow_symlinks=False):
                            directories += 1
                            stack.append(Path(child.path))
                        elif child.is_file(follow_symlinks=False):
                            files += 1
                            ext = Path(child.name).suffix.removeprefix(".").lower()
                            if ext:
                                extension_counts[ext] = extension_counts.get(ext, 0) + 1
                    except OSError:
                        continue
        except OSError:
            continue
    return files, directories, extension_counts, examined >= MAX_INVENTORY_ENTRIES


def analyze_device(record: UsbDeviceRecord) -> DeviceAnalysis:
    if not record.mount_point:
        return DeviceAnalysis(device_id=record.id, filesystem=record.filesystem, total_bytes=record.capacity_bytes, status="unavailable", message="No mounted partition is available for read-only filesystem analysis.")
    try:
        mount = Path(record.mount_point)
        # shutil.disk_usage is cross-platform (Linux, macOS, Windows).
        usage = shutil.disk_usage(str(mount))
        files, directories, extension_counts, truncated = _count_tree(mount)
        return DeviceAnalysis(
            device_id=record.id,
            filesystem=record.filesystem,
            total_bytes=usage.total,
            used_bytes=usage.used,
            free_bytes=usage.free,
            file_count=files,
            directory_count=directories,
            extension_counts=extension_counts,
            status="completed",
            message="Read-only filesystem inventory completed; results are limited to 100,000 entries." if truncated else "Read-only filesystem inventory completed.",
        )
    except OSError:
        return DeviceAnalysis(device_id=record.id, filesystem=record.filesystem, total_bytes=record.capacity_bytes, status="unavailable", message="The mounted USB filesystem could not be read. Check permissions and mount state.")
