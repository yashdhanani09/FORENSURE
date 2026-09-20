import { Route, Routes, useLocation } from "react-router-dom";
import { TopNav } from "./components/TopNav";
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

  // Landing portal — full screen immersive, no top nav
  if (isPortal) {
    return <LandingPortal />;
  }

  // Active Workspace — top nav + scrollable content with ambient spatial lighting
  return (
    <div className="relative flex flex-col h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      {/* ── 3D Cybernetic Ambient Spatial Lighting ── */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_-10%,rgba(6,182,212,0.08),transparent_70%)]" />
      
      <TopNav />
      <main className="relative z-10 flex-1 overflow-y-auto bg-transparent">
        <Routes>
          <Route path="/dashboard"            element={<Dashboard />} />
          <Route path="/devices"              element={<Devices />} />
          <Route path="/devices/:id"          element={<DeviceDetails />} />
          <Route path="/forensics"            element={<Forensics />} />
          <Route path="/forensics/case/:id"   element={<CaseDetail />} />
          <Route path="/recovery"             element={<Recovery />} />
          <Route path="/sanitization"         element={<Sanitization />} />
          <Route path="/agent-guide"          element={<AgentGuide />} />
          <Route path="*"                     element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
