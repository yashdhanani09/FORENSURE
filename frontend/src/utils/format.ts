export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1);
  return `${(bytes / 1000 ** exponent).toFixed(exponent >= 3 ? 1 : 0)} ${units[exponent]}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

export function deviceName(vendor: string | null, model: string | null): string {
  return [vendor, model].filter(Boolean).join(" ") || "Unidentified USB device";
}

export function formatMountPoint(mountPoint?: string | null): string {
  if (!mountPoint) return "Unmounted";
  const trimmed = mountPoint.trim();
  if (!trimmed) return "Unmounted";

  // Standard Windows drive letter (e.g. C:, C:\, D:\, etc.)
  if (/^[A-Za-z]:\\?$/.test(trimmed)) {
    return trimmed.endsWith("\\") ? trimmed.toUpperCase() : `${trimmed.toUpperCase()}\\`;
  }

  // Windows Physical Drive: \\.\PHYSICALDRIVE0 -> Disk 0
  const physMatch = trimmed.match(/^\\\\\.\\physicaldrive(\d+)$/i);
  if (physMatch) {
    return `Disk ${physMatch[1]}`;
  }

  // Windows Volume GUID: \\?\Volume{...} -> Volume (Raw)
  if (/^\\\\\?\\Volume/i.test(trimmed) || /^Volume\{/i.test(trimmed)) {
    return "Volume (Raw)";
  }

  // Windows Portable Device / MTP (e.g. \\.\WPD\USB\...) -> MTP Portable
  if (/^\\\\\.\\WPD/i.test(trimmed) || trimmed.toUpperCase().includes("WPD")) {
    return "MTP Portable";
  }

  // Linux short root / mount paths: /mnt/data, /media/usb
  if (trimmed.startsWith("/") && trimmed.length <= 16) {
    return trimmed;
  }

  // For any other long path, keep it reasonably sized
  if (trimmed.length > 16) {
    return `${trimmed.slice(0, 13)}…`;
  }

  return trimmed;
}
