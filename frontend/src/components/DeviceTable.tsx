import { ChevronRight, HardDrive, Smartphone, Shield, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { UsbDevice } from "../types/device";
import { deviceName, formatBytes, formatMountPoint } from "../utils/format";

export function DeviceTable({ devices }: { devices: UsbDevice[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#1e2c40] bg-[#0f172a]/90 backdrop-blur-sm shadow-xl">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="border-b border-[#1e2c40] bg-[#0b0f19] text-xs font-extrabold tracking-[0.14em] text-slate-300 uppercase">
          <tr>
            <th className="px-6 py-4.5">STORAGE DEVICE</th>
            <th className="px-6 py-4.5">TYPE / BUS</th>
            <th className="px-6 py-4.5">CAPACITY</th>
            <th className="px-6 py-4.5">MOUNT POINT</th>
            <th className="px-6 py-4.5">SAFETY CLEARANCE</th>
            <th className="px-6 py-4.5 text-right">ACTION</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e2c40]/70 font-mono">
          {devices.map((device) => {
            const isSystem = device.system_disk;
            const isMobile = device.device_type === "MOBILE_DEVICE";

            return (
              <tr key={device.id} className="transition-colors hover:bg-white/[0.03]">
                <td className="px-6 py-4.5 font-sans">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`p-3 rounded-xl shrink-0 ${
                      isSystem ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                      isMobile ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                      device.device_type === "INTERNAL_STORAGE" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                      "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    }`}>
                      {isMobile ? <Smartphone className="h-5 w-5" /> : <HardDrive className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-base text-white truncate max-w-[280px]" title={deviceName(device.vendor, device.model)}>{deviceName(device.vendor, device.model)}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400 truncate max-w-[280px]" title={device.serial ?? device.device_path}>{device.serial ?? device.device_path}</p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4.5">
                  <span className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    isSystem ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" :
                    isMobile ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                    device.device_type === "INTERNAL_STORAGE" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                    "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  }`}>
                    {isSystem ? "SYSTEM OS" : device.device_type === "INTERNAL_STORAGE" ? "INTERNAL MACHINE" : (device.device_type || (device.transport ?? "Storage"))}
                  </span>
                </td>

                <td className="px-6 py-4.5 text-slate-100 font-bold font-sans text-sm sm:text-base">
                  {formatBytes(device.capacity_bytes)}
                </td>

                <td className="px-6 py-4.5 font-mono text-slate-300 text-sm max-w-[140px] truncate" title={device.mount_point ?? "Not mounted"}>
                  {device.mount_point ? formatMountPoint(device.mount_point) : <span className="text-slate-500 italic">Not mounted</span>}
                </td>

                <td className="px-6 py-4.5">
                  {isSystem ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      <Shield className="h-3.5 w-3.5" /> WRITE PROTECTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <ShieldCheck className="h-3.5 w-3.5" /> CLEARED
                    </span>
                  )}
                </td>

                <td className="px-6 py-4.5 text-right">
                  <Link 
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1e2c40] bg-[#0b0f19] text-xs sm:text-sm font-sans font-semibold text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors shadow-sm" 
                    aria-label={`Inspect ${deviceName(device.vendor, device.model)}`} 
                    to={`/devices/${encodeURIComponent(device.id)}`}
                  >
                    Inspect <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

