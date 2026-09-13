import axios from "axios";

const AGENT_HEALTH_URL = "http://127.0.0.1:8000/health";
const CHECK_INTERVAL_MS = 10_000;

export interface AgentStatus {
  connected: boolean;
  demoMode: boolean;
  agentUrl: string;
  lastChecked: number | null;
  error?: string | null;
}

class AgentConnectionManager {
  private status: AgentStatus = {
    connected: false,
    demoMode: false,
    agentUrl: "http://127.0.0.1:8000",
    lastChecked: null,
    error: null,
  };

  private listeners: Set<(status: AgentStatus) => void> = new Set();
  private timer: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      const savedDemo = localStorage.getItem("SECUREDATA_DEMO_MODE");
      this.status.demoMode = savedDemo === "true";
      const savedUrl = localStorage.getItem("SECUREDATA_AGENT_URL");
      if (savedUrl) this.status.agentUrl = savedUrl;

      // Start periodic health checking
      this.checkConnection();
      this.timer = setInterval(() => this.checkConnection(), CHECK_INTERVAL_MS);
    }
  }

  public getStatus(): AgentStatus {
    return { ...this.status };
  }

  public isDemoMode(): boolean {
    return this.status.demoMode;
  }

  public setDemoMode(active: boolean) {
    this.status.demoMode = active;
    if (typeof window !== "undefined") {
      localStorage.setItem("SECUREDATA_DEMO_MODE", active ? "true" : "false");
    }
    this.notify();
  }

  public setAgentUrl(url: string) {
    this.status.agentUrl = url.trim();
    if (typeof window !== "undefined") {
      localStorage.setItem("SECUREDATA_AGENT_URL", this.status.agentUrl);
    }
    this.checkConnection();
  }

  public async checkConnection(): Promise<boolean> {
    const targetUrl = this.status.agentUrl.replace(/\/$/, "");
    try {
      const res = await axios.get(`${targetUrl}/health`, {
        timeout: 2500,
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.data?.status === "ok") {
        this.status.connected = true;
        this.status.error = null;
      } else {
        this.status.connected = false;
      }
    } catch (err: any) {
      this.status.connected = false;
      this.status.error = err.message || "Agent unreachable";
    }

    this.status.lastChecked = Date.now();
    this.notify();
    return this.status.connected;
  }

  public subscribe(listener: (status: AgentStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const s = this.getStatus();
    this.listeners.forEach((fn) => fn(s));
  }

  public getApiBaseUrl(): string {
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL;
    }
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      // If we are testing on localhost with Vite proxy, use relative ""
      if ((host === "localhost" || host === "127.0.0.1") && window.location.port === "5174") {
        return "";
      }
    }
    return this.status.agentUrl;
  }
}

export const agentConnection = new AgentConnectionManager();
