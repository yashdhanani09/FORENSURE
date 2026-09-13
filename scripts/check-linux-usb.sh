#!/usr/bin/env sh
set -eu

if ! command -v lsblk >/dev/null 2>&1; then
  echo "lsblk is required. Install the util-linux package on Linux." >&2
  exit 1
fi

lsblk --json --bytes --output NAME,PATH,TYPE,TRAN,RM,SIZE,VENDOR,MODEL,SERIAL,FSTYPE,LABEL,UUID,MOUNTPOINTS,RO,PKNAME

