import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";

export function Header({ title, subtitle, refreshing, onRefresh }: {
  title: string;
  subtitle: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <header className="relative flex flex-col gap-4 border-b border-[#182035] bg-[#0a0f1c]/80 px-6 py-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between lg:px-14 xl:px-16 select-none">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-extrabold tracking-[0.22em] text-cyan-400 uppercase font-mono">
          <ShieldCheck className="h-4 w-4" /> FORENSURE CONSOLE
        </div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-300 leading-relaxed max-w-4xl">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge label="ENGINE LIVE" tone="ready" pulse />
        {onRefresh && (
          <Button variant="outline" size="default" onClick={onRefresh} loading={refreshing} className="h-10 px-4 text-xs sm:text-sm font-semibold rounded-xl border-[#182035] bg-[#0f172a]/70 hover:bg-[#162238] transition-all">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        )}
        <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#182035] bg-[#0d1424] text-xs font-mono text-slate-300 shadow-sm font-bold">
          <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span>PROBE: ACTIVE</span>
        </div>
      </div>
    </header>
  );
}
