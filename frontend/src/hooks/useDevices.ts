import { useCallback, useEffect, useState } from "react";
import { deviceApi } from "../services/api";
import type { DeviceListResponse } from "../types/device";

const REFRESH_INTERVAL_MS = 30_000;

export function useDevices() {
  const [data, setData] = useState<DeviceListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (force = false) => {
    try {
      if (force) {
        setLoading(true);
      }
      const response = await deviceApi.list({ refresh: force });
      setData(response);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to refresh USB devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { devices: data?.devices ?? [], refreshedAt: data?.refreshed_at, error, loading, refresh };
}

