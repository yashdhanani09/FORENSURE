import { Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { AgentStatusBar } from "./components/AgentStatusBar";
import { LandingPortal } from "./pages/LandingPortal";
import { Dashboard } from "./pages/Dashboard";
import { DeviceDetails } from "./pages/DeviceDetails";
import { Devices } from "./pages/Devices";
import { Forensics } from "./pages/Forensics";
import { CaseDetail } from "./pages/CaseDetail";
import { Recovery } from "./pages/Recovery";
import { Sanitization } from "./pages/Sanitization";
import { AgentGuide } from "./pages/AgentGuide";

export default function App() {
  const location = useLocation();
  const isPortal = location.pathname === "/";

  // When visiting the root path, greet user with the 3D GPU Particle Bloom Landing Portal
  if (isPortal) {
    return <LandingPortal />;
  }

  // Active Workspace Layout for all forensic modules
  return (
    <div className="flex h-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#090d16] text-slate-100">
        <AgentStatusBar />
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/devices/:id" element={<DeviceDetails />} />
            <Route path="/forensics" element={<Forensics />} />
            <Route path="/forensics/case/:id" element={<CaseDetail />} />
            <Route path="/recovery" element={<Recovery />} />
            <Route path="/sanitization" element={<Sanitization />} />
            <Route path="/agent-guide" element={<AgentGuide />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
