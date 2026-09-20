import { ArrowRight, HardDrive, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { UsbDevice } from "../types/device";
import { deviceName, formatBytes, formatMountPoint } from "../utils/format";
import { StatusBadge } from "./StatusBadge";

export function DeviceCard({ device }: { device: UsbDevice }) {
  return (
    <article className="scan-line group rounded-xl border border-line bg-panel p-5 shadow-panel transition hover:-translate-y-0.5 hover:border-signal/35">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-signal/20 bg-signal/10 text-signal"><HardDrive className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-white">{deviceName(device.vendor, device.model)}</h3>
            <p className="mt-1 truncate font-mono text-xs text-slate-500">{device.device_path}</p>
          </div>
        </div>
        <StatusBadge label="CONNECTED" tone="ready" />
      </div>
      <div className="my-5 grid grid-cols-2 gap-3 border-y border-line/70 py-4 text-sm">
        <div><p className="text-[10px] font-bold tracking-[.12em] text-slate-500">CAPACITY</p><p className="mt-1 font-medium text-slate-100">{formatBytes(device.capacity_bytes)}</p></div>
        <div><p className="text-[10px] font-bold tracking-[.12em] text-slate-500">FILESYSTEM</p><p className="mt-1 font-medium uppercase text-slate-100">{device.filesystem ?? "Unformatted"}</p></div>
        <div className="col-span-2"><p className="text-[10px] font-bold tracking-[.12em] text-slate-500">MOUNT POINT</p><p className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs text-slate-300" title={device.mount_point ?? "Not mounted"}><MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />{device.mount_point ? formatMountPoint(device.mount_point) : "Not mounted"}</p></div>
      </div>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-signal" /> Removable USB verified</span>
        <Link to={`/devices/${encodeURIComponent(device.id)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-signal transition hover:text-white">Inspect <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
    </article>
  );
}

