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
