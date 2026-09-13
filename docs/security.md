# Security and safety

- The frontend has no endpoint that accepts a raw device path or arbitrary command.
- USB discovery uses a fixed `subprocess.run([...], shell=False)` invocation with a timeout.
- Phase 1 lists only removable (`RM=1`) USB (`TRAN=usb`) whole disks.
- Per-device actions re-enumerate the device before acting, so a stale browser selection is rejected.
- Phase 1 is entirely read-only: it neither mounts, unmounts, writes, nor invokes recovery tools.
- The service writes structured operational events to `logs/securedata-api.log`; avoid putting sensitive case content in logs.
- Run the API as an unprivileged user. Future privileged actions should be a separately audited, narrowly allow-listed helper rather than an elevated web server.

Demo Mode returns a labelled sample USB and never represents a real device. Use it for presentations and UI development only.

