"""Safety constants shared by future privileged storage operations.

Phase 1 does not contain an endpoint that executes device commands.  Future
sanitization services must use an allow-listed device record resolved server-side.
"""

ALLOWED_SANITIZATION_METHODS = {"single_pass_overwrite"}

