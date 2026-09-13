# Architecture

SecureData is split into a browser-only React interface and a Linux-aware FastAPI service. The browser receives device summaries and sends opaque device IDs; it never sends a block-device path or a command to execute.

```
React dashboard ──GET /api/devices──> FastAPI ──fixed lsblk query──> Linux block layer
       │                                      │
       ├──POST /{opaque-id}/analyze───────────┴──read-only statvfs + bounded inventory
       └──GET /{opaque-id}/files──────────────┴──mount-bound metadata listing
                                              │
                                       SQLite / audit-ready models
```

Phase 1 detects only whole-disk devices where `TYPE=disk`, `TRAN=usb`, and `RM=1`. This intentionally excludes internal disks and non-removable USB-attached storage. `lsblk` JSON is parsed server-side; a SHA-256-derived device ID is returned to the browser. Serial-led identities remain stable across normal device re-enumeration, with a kernel-name fallback only where no serial exists.

`Device`, `Operation`, `Evidence`, and `Report` SQLAlchemy models are present now. Alembic owns the initial migration. The current startup initializer is a developer convenience for a fresh SQLite database; deployment should apply `alembic upgrade head` before starting the service.

Future phases will introduce a narrowly scoped privileged helper for unmount and overwrite operations. The web server must not run as root and no arbitrary-command API will be added.

Directory browsing never accepts a host path. The service normalizes a relative path, resolves it below the current mount root, refuses any escape, and does not follow symlinks during listing or inventory. The tree counter is bounded at 100,000 entries so a very large USB cannot cause an unbounded scan in the synchronous Phase 2 endpoint.
