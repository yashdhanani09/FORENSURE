"""NTFS Master File Table (MFT) Record Forensic Carver & Parser.

Parses 1024-byte MFT records directly from raw disk sectors, cluster dumps, or physical volumes.
Extracts deleted file records (where flags & 0x0001 == 0), recovering original filenames ($FILE_NAME 0x30)
and resident payloads ($DATA 0x80) for text files, small documents, and scripts even after
the Recycle Bin has been emptied or Shift+Delete was used.
"""

from __future__ import annotations

import logging
import struct
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

MFT_RECORD_SIZE = 1024
ATTR_FILE_NAME = 0x30
ATTR_DATA = 0x80
ATTR_END = 0xFFFFFFFF


@dataclass
class DeletedMftItem:
    filename: str
    size_bytes: int
    deleted_at: Optional[datetime]
    data: Optional[bytes]
    offset_bytes: int
    is_directory: bool
    record_number: int
    data_runs: Optional[List[Tuple[int, int]]] = None


def decode_data_runs(runlist_bytes: bytes) -> List[Tuple[int, int]]:
    """
    Decodes an NTFS non-resident attribute data runlist.
    Returns a list of (lcn, cluster_count) tuples.
    If lcn is 0, it represents a sparse cluster run.
    """
    runs: List[Tuple[int, int]] = []
    pos = 0
    prev_lcn = 0
    data_len = len(runlist_bytes)

    while pos < data_len:
        header = runlist_bytes[pos]
        if header == 0:
            break
        pos += 1

        len_size = header & 0x0F          # Low nibble: number of bytes for run length
        offset_size = (header >> 4) & 0x0F # High nibble: number of bytes for LCN delta

        if len_size == 0 or pos + len_size + offset_size > data_len:
            break

        # Read run length (cluster count) - unsigned integer
        run_length = int.from_bytes(runlist_bytes[pos:pos + len_size], byteorder="little", signed=False)
        pos += len_size

        if offset_size == 0:
            # Sparse run
            lcn = 0
        else:
            # Read LCN delta - SIGNED integer in two's complement
            lcn_delta = int.from_bytes(runlist_bytes[pos:pos + offset_size], byteorder="little", signed=True)
            pos += offset_size
            current_lcn = prev_lcn + lcn_delta
            prev_lcn = current_lcn
            lcn = current_lcn

        runs.append((lcn, run_length))

    return runs


def _filetime_to_datetime(filetime: int) -> Optional[datetime]:
    """Converts 64-bit Windows FILETIME (100-nanosecond intervals since Jan 1 1601) to UTC datetime."""
    if filetime <= 0:
        return None
    try:
        return datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=filetime // 10)
    except Exception:
        return None


def parse_mft_record(record_bytes: bytes, offset_bytes: int = 0) -> Optional[DeletedMftItem]:
    """
    Parses a single 1024-byte NTFS MFT record.
    Returns DeletedMftItem if this record belongs to a deleted/unallocated file with a valid name.
    Supports both resident ($DATA <= ~700 bytes) and non-resident cluster runs (large files).
    """
    if len(record_bytes) < MFT_RECORD_SIZE:
        return None

    # Verify 'FILE' magic signature
    if record_bytes[:4] != b"FILE":
        return None

    try:
        # Read MFT Record Header fields
        first_attr_offset = struct.unpack("<H", record_bytes[20:22])[0]
        flags = struct.unpack("<H", record_bytes[22:24])[0]
        bytes_used = struct.unpack("<I", record_bytes[24:28])[0]
        record_number = struct.unpack("<I", record_bytes[44:48])[0] if len(record_bytes) >= 48 else 0

        is_in_use = (flags & 0x0001) != 0
        is_directory = (flags & 0x0002) != 0

        # We are specifically hunting for DELETED (unallocated) records
        if is_in_use or is_directory:
            return None

        # Sanity check offsets
        if first_attr_offset >= MFT_RECORD_SIZE or bytes_used > MFT_RECORD_SIZE:
            return None

        curr_offset = first_attr_offset
        extracted_name: Optional[str] = None
        best_name_priority: int = -1
        extracted_size: int = 0
        extracted_time: Optional[datetime] = None
        extracted_data: Optional[bytes] = None
        extracted_runs: Optional[List[Tuple[int, int]]] = None

        # Loop through record attributes
        while curr_offset + 8 <= min(bytes_used, MFT_RECORD_SIZE):
            attr_type = struct.unpack("<I", record_bytes[curr_offset:curr_offset + 4])[0]
            if attr_type == ATTR_END:
                break

            attr_len = struct.unpack("<I", record_bytes[curr_offset + 4:curr_offset + 8])[0]
            if attr_len <= 0 or curr_offset + attr_len > MFT_RECORD_SIZE:
                break

            non_resident = record_bytes[curr_offset + 8] if curr_offset + 8 < MFT_RECORD_SIZE else 1

            # 1. $FILE_NAME Attribute (0x30)
            if attr_type == ATTR_FILE_NAME and non_resident == 0:
                try:
                    content_offset = struct.unpack("<H", record_bytes[curr_offset + 20:curr_offset + 22])[0]
                    content_len = struct.unpack("<I", record_bytes[curr_offset + 16:curr_offset + 20])[0]
                    content_start = curr_offset + content_offset
                    content_end = content_start + content_len

                    if content_end <= curr_offset + attr_len and content_end <= MFT_RECORD_SIZE:
                        fn_body = record_bytes[content_start:content_end]
                        if len(fn_body) >= 66:
                            # 0x10 Alteration time (modification/deletion)
                            mod_filetime = struct.unpack("<Q", fn_body[16:24])[0]
                            dt = _filetime_to_datetime(mod_filetime)
                            if dt and not extracted_time:
                                extracted_time = dt

                            # 0x30 Real size
                            real_size = struct.unpack("<Q", fn_body[48:56])[0]
                            if real_size > 0 and extracted_size == 0:
                                extracted_size = real_size

                            # 0x40 (offset 64): Filename length in UTF-16 chars
                            name_len = fn_body[64] if len(fn_body) > 64 else 0
                            # 0x41 (offset 65): Namespace (0=POSIX, 1=Win32, 2=DOS, 3=Win32&DOS)
                            namespace = fn_body[65] if len(fn_body) > 65 else 0
                            name_start = 66
                            name_end = name_start + (name_len * 2)

                            # Priority: Win32 (1) = 3, Win32&DOS (3) = 2, POSIX (0) = 1, DOS (2) = 0
                            priority_map = {1: 3, 3: 2, 0: 1, 2: 0}
                            prio = priority_map.get(namespace, 1)

                            if name_end <= len(fn_body):
                                decoded_name = fn_body[name_start:name_end].decode("utf-16le", errors="ignore").rstrip("\x00")
                                # Avoid system metadata names like $MFT, $Volume, etc.
                                if decoded_name and not decoded_name.startswith("$"):
                                    if prio > best_name_priority or not extracted_name:
                                        extracted_name = decoded_name
                                        best_name_priority = prio
                except Exception:
                    pass

            # 2. $DATA Attribute (0x80)
            elif attr_type == ATTR_DATA:
                try:
                    if non_resident == 0:
                        # Resident data: payload is inside the MFT record
                        data_len = struct.unpack("<I", record_bytes[curr_offset + 16:curr_offset + 20])[0]
                        data_offset = struct.unpack("<H", record_bytes[curr_offset + 20:curr_offset + 22])[0]
                        data_start = curr_offset + data_offset
                        data_end = data_start + data_len

                        if data_end <= curr_offset + attr_len and data_end <= MFT_RECORD_SIZE:
                            extracted_data = record_bytes[data_start:data_end]
                            if extracted_size == 0 or extracted_size > len(extracted_data):
                                extracted_size = data_len
                    else:
                        # Non-resident data: cluster runlist
                        # Offset 32-33: Runlist offset
                        # Offset 48-55: Real file size (uint64)
                        if curr_offset + 56 <= MFT_RECORD_SIZE:
                            runlist_rel = struct.unpack("<H", record_bytes[curr_offset + 32:curr_offset + 34])[0]
                            non_res_real_size = struct.unpack("<Q", record_bytes[curr_offset + 48:curr_offset + 56])[0]
                            if non_res_real_size > 0:
                                extracted_size = non_res_real_size

                            runlist_start = curr_offset + runlist_rel
                            if runlist_start < curr_offset + attr_len and runlist_start < MFT_RECORD_SIZE:
                                runlist_bytes = record_bytes[runlist_start:curr_offset + attr_len]
                                decoded_runs = decode_data_runs(runlist_bytes)
                                if decoded_runs:
                                    extracted_runs = decoded_runs
                except Exception:
                    pass

            curr_offset += attr_len

        if extracted_name:
            return DeletedMftItem(
                filename=extracted_name,
                size_bytes=extracted_size,
                deleted_at=extracted_time,
                data=extracted_data,
                offset_bytes=offset_bytes,
                is_directory=False,
                record_number=record_number,
                data_runs=extracted_runs,
            )

    except Exception as exc:
        logger.debug("Error parsing MFT record at offset 0x%X: %s", offset_bytes, exc)

def parse_record0_mft_runs(record0_bytes: bytes) -> Tuple[int, List[Tuple[int, int]]]:
    """
    Parses Record 0 ($MFT itself) to extract the real total allocated size and all cluster data runs of the $MFT.
    Returns (real_size, list_of_runs).
    """
    if len(record0_bytes) < MFT_RECORD_SIZE or record0_bytes[:4] != b"FILE":
        return 0, []

    try:
        first_attr_offset = struct.unpack("<H", record0_bytes[20:22])[0]
        bytes_used = struct.unpack("<I", record0_bytes[24:28])[0]
        curr_offset = first_attr_offset

        while curr_offset + 8 <= min(bytes_used, MFT_RECORD_SIZE):
            attr_type = struct.unpack("<I", record0_bytes[curr_offset:curr_offset + 4])[0]
            if attr_type == ATTR_END:
                break
            attr_len = struct.unpack("<I", record0_bytes[curr_offset + 4:curr_offset + 8])[0]
            if attr_len <= 0 or curr_offset + attr_len > MFT_RECORD_SIZE:
                break

            non_resident = record0_bytes[curr_offset + 8] if curr_offset + 8 < MFT_RECORD_SIZE else 0

            # $DATA attribute (0x80) of $MFT
            if attr_type == ATTR_DATA and non_resident == 1:
                runlist_rel = struct.unpack("<H", record0_bytes[curr_offset + 32:curr_offset + 34])[0]
                real_sz = struct.unpack("<Q", record0_bytes[curr_offset + 48:curr_offset + 56])[0]
                runlist_start = curr_offset + runlist_rel
                if runlist_start < curr_offset + attr_len:
                    run_bytes = record0_bytes[runlist_start:curr_offset + attr_len]
                    runs = decode_data_runs(run_bytes)
                    if runs:
                        return real_sz, runs

            curr_offset += attr_len
    except Exception as exc:
        logger.debug("Error parsing record 0 MFT data runs: %s", exc)

    return 0, []


DEV_NOISE_EXTENSIONS = {
    ".map", ".d.ts", ".cjs", ".mjs", ".cts", ".mts", ".npmignore",
    ".eslintrc", ".eslintignore", ".prettierrc", ".prettierignore",
    ".babelrc", ".browserslistrc", ".flowconfig", ".editorconfig",
    ".gitkeep", ".gitignore", ".gitattributes", ".lock", ".yarnclean",
    ".tsbuildinfo", ".node",
}

DEV_NOISE_NAMES = {
    "package.json", "package-lock.json", "tsconfig.json", "jsconfig.json",
    "yarn.lock", "pnpm-lock.yaml", "rollup.config.js", "webpack.config.js",
    "vite.config.ts", "vite.config.js", "tailwind.config.js", "postcss.config.js",
}


def scan_mft_records_from_stream(
    data: bytes,
    base_offset: int = 0,
    max_items: int = 15000,
    ignore_synthetic: bool = True,
) -> List[DeletedMftItem]:
    """
    Scans a raw sector buffer for 1024-byte aligned and unaligned 'FILE' MFT records.
    Extracts all valid deleted file records found with fast in-memory active-record filtering.
    Filters out ephemeral build artifacts (.map, .d.ts, .cjs) and synthetic carver test files.
    """
    found_items: List[DeletedMftItem] = []
    seen_names = set()
    data_len = len(data)
    ext_counts: dict[str, int] = {}

    # Standard sector alignment: 512 or 1024 bytes
    step = 512
    pos = 0

    while pos + MFT_RECORD_SIZE <= data_len:
        if data[pos:pos + 4] == b"FILE":
            # Fast in-memory filter: flags are at offset 22-23 (uint16)
            # Bit 0 (0x0001) = in_use. If set, file is active -> skip attribute decoding immediately
            flags = data[pos + 22] | (data[pos + 23] << 8)
            if (flags & 0x0001) == 0:
                item = parse_mft_record(data[pos:pos + MFT_RECORD_SIZE], offset_bytes=base_offset + pos)
                if item and item.filename:
                    clean_name = item.filename.strip()
                    low_name = clean_name.lower()

                    # 1. Skip system metadata files ($MFT, $LogFile, $Volume, etc.)
                    if not clean_name or len(clean_name) <= 1 or clean_name.startswith("$"):
                        pos += MFT_RECORD_SIZE
                        continue

                    # 2. Skip synthetic remnants from prior carving test runs (recovered_*, carved_*)
                    if ignore_synthetic and low_name.startswith(("recovered_", "carved_")):
                        pos += MFT_RECORD_SIZE
                        continue

                    # 3. Skip development build chaff / source maps
                    if low_name in DEV_NOISE_NAMES or any(low_name.endswith(ne) for ne in DEV_NOISE_EXTENSIONS):
                        pos += MFT_RECORD_SIZE
                        continue

                    # 4. Cap common web code extensions (.js, .ts, .json) to prevent node_modules flooding
                    file_ext = low_name.split(".")[-1] if "." in low_name else ""
                    if file_ext in {"js", "ts", "json", "css", "scss"}:
                        cur_cnt = ext_counts.get(file_ext, 0)
                        if cur_cnt >= 40:
                            pos += MFT_RECORD_SIZE
                            continue
                        ext_counts[file_ext] = cur_cnt + 1

                    # 5. Deduplicate by filename + size
                    key = (low_name, item.size_bytes)
                    if key not in seen_names:
                        seen_names.add(key)
                        found_items.append(item)
                        if len(found_items) >= max_items:
                            break
            pos += MFT_RECORD_SIZE
        else:
            pos += step

    return found_items

