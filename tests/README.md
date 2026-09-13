# Test scope

Top-level tests will hold cross-service and end-to-end coverage in later phases. Phase 1 test suites live alongside their code:

- `backend/tests`: `lsblk` parser and opaque-ID API tests using a safe demo record.
- `frontend/src/pages/Dashboard.test.tsx`: dashboard rendering and inspection routing with a mocked API.

No current test opens, mounts, unmounts, or writes a real storage device.

