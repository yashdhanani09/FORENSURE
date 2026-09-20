import React, { useState, useMemo } from "react";
import { Header } from "../components/Header";
import { DeviceTable } from "../components/DeviceTable";
import { EmptyState } from "../components/EmptyState";
import { useDevices } from "../hooks/useDevices";
import { Search, HardDrive, Smartphone, Usb, Filter, ShieldCheck } from "lucide-react";

type FilterCategory = "all" | "internal" | "usb" | "data_volume" | "mobile" | "system";

export function Devices() {
  const { devices, loading, error, refresh } = useDevices();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("all");

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

      <div className="w-full max-w-[1550px] mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-6 select-none page-enter">
        {/* Filter bar & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === "all"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              All Storage ({counts.all})
            </button>
            <button
              onClick={() => setFilter("internal")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === "internal"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-glow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              Internal Machine ({counts.internal})
            </button>
            <button
              onClick={() => setFilter("data_volume")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === "data_volume"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              Data Volumes ({counts.data_volume})
            </button>
            <button
              onClick={() => setFilter("mobile")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === "mobile"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              Mobile (MTP) ({counts.mobile})
            </button>
            <button
              onClick={() => setFilter("usb")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === "usb"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              USB Drives ({counts.usb})
            </button>
            <button
              onClick={() => setFilter("system")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === "system"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "border border-[#1e2c40] bg-[#0f172a] text-slate-400 hover:text-white"
              }`}
            >
              System Disks ({counts.system})
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search storage devices..."
              className="w-full bg-[#0f172a] border border-[#1e2c40] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-xs font-mono text-rose-300">
            Hardware Probe Error: {error}
          </div>
        )}

        {loading && !devices.length ? (
          <div className="h-72 animate-pulse rounded-2xl border border-[#1e2c40] bg-[#0f172a]/50" />
        ) : filteredDevices.length ? (
          <DeviceTable devices={filteredDevices} />
        ) : (
          <EmptyState />
        )}
      </div>
    </>
  );
}
