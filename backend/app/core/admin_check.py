"""Admin privilege detection utility for Windows.

Provides is_admin() and require_admin_or_warn() that other services can call.
On non-Windows platforms is_admin() always returns True (no restriction needed).
"""
from __future__ import annotations

import logging
import platform

logger = logging.getLogger(__name__)


def is_admin() -> bool:
    """Return True if the current process has Administrator / root privileges."""
    system = platform.system()
    if system == "Windows":
        try:
            import ctypes
            return bool(ctypes.windll.shell32.IsUserAnAdmin())
        except Exception:
            return False
    # Linux / macOS: check effective UID
    try:
        import os
        return os.geteuid() == 0
    except AttributeError:
        return True  # Non-POSIX, assume OK


def require_admin_or_warn(context: str = "device detection") -> None:
    """Log a clear, actionable warning if not running as Administrator."""
    if not is_admin():
        logger.warning(
            "SecureData is NOT running as Administrator. "
            "%s will be limited or unavailable. "
            "Please restart the backend terminal as Administrator "
            "(right-click → Run as Administrator).",
            context,
        )
