# API (Phase 1)

Interactive OpenAPI documentation is available at `/docs` and `/redoc` when the backend is running.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Process health check |
| `GET` | `/api/system/status` | Platform and Demo Mode capability result |
| `GET` | `/api/devices` | List currently eligible removable USB drives |
| `GET` | `/api/devices/{device_id}` | Re-enumerate and return detailed device information |
| `POST` | `/api/devices/{device_id}/analyze` | Run a read-only mounted-filesystem capacity analysis |
| `GET` | `/api/devices/{device_id}/files` | List directory metadata under the current USB mount |

`device_id` is server-generated. A device path in a URL, body, or command is not a supported input. A missing/stale ID returns `404`; when Linux detection is unavailable, device endpoints return `503` with a safe user-facing message.

The file endpoint accepts only a USB-relative `path`, which is normalized and resolved below the currently mounted root. Absolute paths, parent traversal, and mount-escaping symlinks are rejected. Supported query controls are `search`, `kind` (`all`, `file`, `directory`), `sort_by` (`name`, `size`, `modified`, `type`), `sort_order`, `offset`, and `limit` (maximum 500).

Example response shape:

```json
{
  "id": "usb_476fc8e9c3b801bf035a0d24",
  "device_path": "/dev/sdb",
  "vendor": "SanDisk",
  "model": "Ultra",
  "capacity_bytes": 64000000000,
  "filesystem": "vfat",
  "mount_point": "/media/operator/CASEFILES",
  "removable": true,
  "read_only": false,
  "transport": "usb"
}
```
