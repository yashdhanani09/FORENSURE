import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import { DeviceTable } from "../components/DeviceTable";
import { EmptyState } from "../components/EmptyState";
import { useDevices } from "../hooks/useDevices";
import { deviceName, formatBytes, formatMountPoint } from "../utils/format";
import { 
  Search, HardDrive, Smartphone, Usb, Filter, ShieldCheck, 
  LayoutGrid, List, ChevronRight, Shield, RotateCcw 
} from "lucide-react";

type FilterCategory = "all" | "internal" | "usb" | "data_volume" | "mobile" | "system";

export function Devices() {
  const { devices, loading, error, refresh } = useDevices();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      // Category filter
      if (filter === "internal" && d.device_type !== "INTERNAL_STORAGE" && (d.is_usb || d.transport === "usb")) return false;
      if (filter === "usb" && !d.is_usb && d.transport !== "usb") return false;
      if (filter === "mobile" && d.device_type !== "MOBILE_DEVICE") return false;
      if (filter === "data_volume" && d.device_type !== "DATA_VOLUME" && d.device_type !== "INTERNAL_STORAGE") return false;
      if (filter === "system" && !d.system_disk) return false;

      // Text search
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (d.vendor && d.vendor.toLowerCase().includes(q)) ||
        (d.model && d.model.toLowerCase().includes(q)) ||
        (d.device_path && d.device_path.toLowerCase().includes(q)) ||
        (d.mount_point && d.mount_point.toLowerCase().includes(q)) ||
        (d.serial && d.serial.toLowerCase().includes(q))
      );
    });
  }, [devices, search, filter]);

  const counts = useMemo(() => {
    return {
      all: devices.length,
      internal: devices.filter(d => d.device_type === "INTERNAL_STORAGE" || (!d.is_usb && d.transport !== "usb" && d.device_type !== "MOBILE_DEVICE")).length,
      usb: devices.filter(d => d.is_usb || d.transport === "usb").length,
      data_volume: devices.filter(d => d.device_type === "DATA_VOLUME" || d.device_type === "INTERNAL_STORAGE").length,
      mobile: devices.filter(d => d.device_type === "MOBILE_DEVICE").length,
      system: devices.filter(d => d.system_disk).length
    };
  }, [devices]);

  return (
    <>
      <Header 
        title="Physical Storage Fleet Inventory" 
        subtitle="Live hardware discovery across NVMe SSDs, SATA disks, data partitions, USB mass storage, and MTP portable mobile devices." 
        refreshing={loading} 
        onRefresh={() => void refresh(true)} 
      />

      <div className="w-full max-w-[1850px] mx-auto px-6 sm:px-10 lg:px-14 xl:px-16 py-8 space-y-6 select-none page-enter">
        {/* Filter bar & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
                filter === "all"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              All Storage ({counts.all})
            </button>
            <button
              onClick={() => setFilter("internal")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
                filter === "internal"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-glow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              Internal Machine ({counts.internal})
            </button>
            <button
              onClick={() => setFilter("data_volume")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
                filter === "data_volume"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              Data Volumes ({counts.data_volume})
            </button>
            <button
              onClick={() => setFilter("mobile")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
                filter === "mobile"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              Mobile (MTP) ({counts.mobile})
            </button>
            <button
              onClick={() => setFilter("usb")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
                filter === "usb"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              USB Drives ({counts.usb})
            </button>
            <button
              onClick={() => setFilter("system")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
                filter === "system"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              System Disks ({counts.system})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search storage devices..."
                className="w-full bg-[#0f172a] border border-[#1e2c40] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* View Mode Toggle: Grid (Dashboard Squares) vs Table */}
            <div className="flex items-center p-1 rounded-xl bg-[#090e1a] border border-[#1e2c40] shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition flex items-center gap-1.5 text-xs font-bold ${
                  viewMode === "grid"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Dashboard Squares View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Squares</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition flex items-center gap-1.5 text-xs font-bold ${
                  viewMode === "table"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-xs font-mono text-rose-300">
            Hardware Probe Error: {error}
          </div>
        )}

        {loading && !devices.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl border border-[#1e2c40] bg-[#0c1220]/50" />
            ))}
          </div>
        ) : filteredDevices.length ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 lg:gap-8">
              {filteredDevices.map((device) => {
                const isSystem = device.system_disk;
                const isMobile = device.device_type === "MOBILE_DEVICE";
                const isUsb = device.is_usb || device.transport === "usb";

                return (
                  <div
                    key={device.id}
                    className="group relative rounded-3xl border border-border-subtle bg-surface-card backdrop-blur-2xl p-7 lg:p-8 shadow-2xl transition-all duration-300 hover:border-brand/50 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(47,129,247,0.18)] flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      {/* Card Header: Icon + Title + Status Badge */}
                      <div className="flex items-start justify-between gap-3 mb-5">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`p-3 rounded-2xl shrink-0 ${
                            isSystem ? "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/25 shadow-[0_0_15px_rgba(239,68,68,0.15)]" :
                            isMobile ? "bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30 shadow-[0_0_15px_rgba(167,139,250,0.15)]" :
                            device.device_type === "INTERNAL_STORAGE" ? "bg-[#2F81F7]/10 text-[#2F81F7] border border-[#2F81F7]/25 shadow-[0_0_15px_rgba(47,129,247,0.15)]" :
                            "bg-brand/10 text-brand border border-brand/25 shadow-[0_0_15px_rgba(47,129,247,0.15)]"
                          }`}>
                            {isMobile ? <Smartphone className="h-6 w-6" /> : isUsb ? <Usb className="h-6 w-6" /> : <HardDrive className="h-6 w-6" />}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-black text-text-primary truncate group-hover:text-brand transition" title={deviceName(device.vendor, device.model)}>
                              {deviceName(device.vendor, device.model)}
                            </h3>
                            <p className="text-xs font-mono text-text-secondary truncate mt-0.5" title={device.device_path}>
                              {device.device_path}
                            </p>
                          </div>
                        </div>

                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                          isSystem ? "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30" :
                          isMobile ? "bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30" :
                          isUsb ? "bg-[#2F81F7]/15 text-[#2F81F7] border-[#2F81F7]/30" :
                          "bg-brand/15 text-brand border-brand/30"
                        }`}>
                          {isSystem ? "SYSTEM OS" : isMobile ? "MTP PHONE" : isUsb ? "USB REMOVABLE" : "INTERNAL DISK"}
                        </span>
                      </div>

                      {/* Capacity Big Metric Box */}
                      <div className="p-4 rounded-2xl bg-surface-elevated border border-border-subtle mb-5 flex items-center justify-between gap-3 overflow-hidden">
                        <div className="shrink-0">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold block">
                            STORAGE CAPACITY
                          </span>
                          <span className="text-2xl sm:text-3xl font-black font-mono text-brand tracking-tight">
                            {formatBytes(device.capacity_bytes || (device as any).size_bytes || 0)}
                          </span>
                        </div>
                        <div className="text-right min-w-0 flex-1 overflow-hidden">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold block">
                            MOUNT POINT
                          </span>
                          <span
                            className="text-sm font-mono font-bold text-text-primary truncate block max-w-full"
                            title={device.mount_point || "Unmounted"}
                          >
                            {formatMountPoint(device.mount_point)}
                          </span>
                        </div>
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs mb-5">
                        <div className="p-3 rounded-xl bg-surface border border-border-subtle">
                          <span className="text-text-secondary font-sans block text-[10px] uppercase font-semibold">Filesystem</span>
                          <span className="text-text-primary font-mono font-bold uppercase mt-0.5 block truncate">
                            {device.filesystem || (device.partitions?.[0]?.filesystem) || "NTFS / RAW"}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-surface border border-border-subtle">
                          <span className="text-text-secondary font-sans block text-[10px] uppercase font-semibold">Safety Clearance</span>
                          <span className={`font-mono font-bold text-[11px] mt-0.5 flex items-center gap-1 truncate ${
                            isSystem ? "text-[#EF4444]" : "text-[#22C55E]"
                          }`}>
                            {isSystem ? <Shield className="w-3.5 h-3.5 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
                            {isSystem ? "WRITE-PROTECTED" : "READ-ONLY BLOCKED"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Action Links */}
                    <div className="pt-4 border-t border-border-subtle flex items-center justify-between gap-2">
                      <Link
                        to={`/devices/${encodeURIComponent(device.id)}`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 text-xs font-bold transition shadow-sm"
                      >
                        <span>Inspect Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        to={`/recovery?target=${encodeURIComponent(device.id)}`}
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle text-xs font-semibold transition"
                        title="Run Forensic Recovery on this drive"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-brand" />
                        <span>Recover</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <DeviceTable devices={filteredDevices} />
          )
        ) : (
          <EmptyState />
        )}
      </div>
    </>
  );
}
