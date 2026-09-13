# Sanitization workflow

Sanitization is not implemented in Phase 1. There is no endpoint, button, or shell execution path that writes to a storage device.

The approved future workflow is: opaque-ID selection → fresh server-side discovery → USB/removable check → root/system-disk exclusion → identity fingerprint comparison → explicit two-step user confirmation displaying capacity and serial → unmount → bounded overwrite method → sampling verification → certificate/audit report. A successful process exit will not by itself count as verification.

