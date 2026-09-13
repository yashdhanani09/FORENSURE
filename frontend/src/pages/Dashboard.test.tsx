import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "./Dashboard";

vi.mock("../services/api", () => ({
  deviceApi: {
    list: vi.fn().mockResolvedValue({
      refreshed_at: "2026-09-07T12:00:00Z",
      devices: [{ id: "usb_1", device_path: "\\\\.\\PHYSICALDRIVE1", vendor: "SanDisk", model: "Ultra", serial: "AA00001", capacity_bytes: 64000000000, filesystem: "exfat", mount_point: "E:\\", removable: true, read_only: false, transport: "usb", detected_at: "2026-09-07T12:00:00Z" }]
    }),
    status: vi.fn().mockResolvedValue({ platform_supported: true, device_detection_available: true, message: "Windows USB detection is ready." })
  }
}));

describe("Dashboard", () => {
  it("shows a discovered USB device with action buttons", async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText("SanDisk Ultra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sanitize/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /forensics/i })).toBeInTheDocument();
  });
});
