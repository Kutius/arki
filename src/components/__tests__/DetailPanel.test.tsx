import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailPanel } from "../detail-panel/DetailPanel";
import { TooltipProvider } from "../ui/tooltip";

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

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const mockEntry = {
  name: "test.txt",
  path: "folder/test.txt",
  isDirectory: false,
  size: 1024,
  compressedSize: 512,
  modified: "2024-01-15",
};

describe("DetailPanel", () => {
  it("renders nothing when entry is null", () => {
    const { container } = renderWithTooltip(
      <DetailPanel entry={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders file name", () => {
    renderWithTooltip(<DetailPanel entry={mockEntry} />);
    expect(screen.getByText("test.txt")).toBeInTheDocument();
  });

  it("renders file size", () => {
    renderWithTooltip(<DetailPanel entry={mockEntry} />);
    expect(screen.getByText("1 KB")).toBeInTheDocument();
  });

  it("renders compressed size", () => {
    renderWithTooltip(<DetailPanel entry={mockEntry} />);
    expect(screen.getByText("512 B")).toBeInTheDocument();
  });

  it("renders modified date", () => {
    renderWithTooltip(<DetailPanel entry={mockEntry} />);
    expect(screen.getByText("2024-01-15")).toBeInTheDocument();
  });

  it("renders file path", () => {
    renderWithTooltip(<DetailPanel entry={mockEntry} />);
    expect(screen.getByText("folder/test.txt")).toBeInTheDocument();
  });

  it("renders archive stats when provided", () => {
    renderWithTooltip(
      <DetailPanel
        entry={mockEntry}
        totalEntries={10}
        totalSize={10240}
        compressedSize={5120}
      />
    );
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("10 KB")).toBeInTheDocument();
    expect(screen.getByText("5 KB")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = renderWithTooltip(<DetailPanel entry={mockEntry} onClose={onClose} />);
    // Find the X button in the header (first button with the specific class)
    const header = container.querySelector(".border-b");
    const closeButton = header?.querySelector("button");
    closeButton?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
