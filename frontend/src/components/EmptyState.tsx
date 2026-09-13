import { Usb } from "lucide-react";

export function EmptyState({ unsupported = false }: { unsupported?: boolean }) {
  return <div className="rounded-xl border border-dashed border-line bg-panel/70 px-6 py-16 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-line bg-[#0b1726] text-slate-500"><Usb className="h-5 w-5" /></div><h3 className="mt-4 font-medium text-slate-200">{unsupported ? "USB detection unavailable on this system" : "No removable USB drive detected"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{unsupported ? "SecureData supports Windows (PowerShell), Linux (lsblk), and macOS (diskutil). Ensure the required tool is available on your system." : "Connect a removable USB storage device. SecureData refreshes its device inventory every five seconds."}</p></div>;
}

