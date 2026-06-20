import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WelcomeView } from "../WelcomeView";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
    onThemeChanged: vi.fn().mockResolvedValue(() => {}),
    setTheme: vi.fn(),
    theme: vi.fn().mockResolvedValue("dark"),
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

describe("WelcomeView", () => {
  it("renders the hero section", () => {
    render(<WelcomeView onCreate={() => {}} />);
    expect(screen.getByText("Open an archive")).toBeInTheDocument();
  });

  it("renders create archive button", () => {
    render(<WelcomeView onCreate={() => {}} />);
    expect(screen.getByText("Create Archive")).toBeInTheDocument();
  });

  it("shows empty history message when no history", () => {
    render(<WelcomeView onCreate={() => {}} />);
    expect(screen.getByText("No recent files yet")).toBeInTheDocument();
  });

  it("calls onCreate when create button is clicked", () => {
    const onCreate = vi.fn();
    render(<WelcomeView onCreate={onCreate} />);
    screen.getByText("Create Archive").click();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
