import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileListView } from "../file-list/FileListView";
import type { ArchiveEntry } from "../../store/archiveStore";

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

const mockEntries: ArchiveEntry[] = [
  { name: "folder1", path: "folder1", isDirectory: true, size: 0 },
  { name: "file1.txt", path: "file1.txt", isDirectory: false, size: 1024, modified: "2024-01-15" },
  { name: "file2.txt", path: "file2.txt", isDirectory: false, size: 2048, modified: "2024-01-16" },
];

describe("FileListView", () => {
  it("renders file entries", () => {
    render(<FileListView entries={mockEntries} currentPath="/" />);
    expect(screen.getByText("folder1")).toBeInTheDocument();
    expect(screen.getByText("file1.txt")).toBeInTheDocument();
    expect(screen.getByText("file2.txt")).toBeInTheDocument();
  });

  it("renders empty state when no entries", () => {
    render(<FileListView entries={[]} currentPath="/" />);
    expect(screen.getByText("No files found")).toBeInTheDocument();
  });

  it("renders breadcrumb with Root", () => {
    render(<FileListView entries={mockEntries} currentPath="/" />);
    expect(screen.getByText("Root")).toBeInTheDocument();
  });

  it("renders size column", () => {
    render(<FileListView entries={mockEntries} currentPath="/" />);
    expect(screen.getByText("1 KB")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("renders modified column", () => {
    render(<FileListView entries={mockEntries} currentPath="/" />);
    expect(screen.getByText("2024-01-15")).toBeInTheDocument();
    expect(screen.getByText("2024-01-16")).toBeInTheDocument();
  });

  it("shows search bar when searchVisible is true", () => {
    render(
      <FileListView
        entries={mockEntries}
        currentPath="/"
        searchVisible={true}
      />
    );
    expect(screen.getByPlaceholderText("Filter files...")).toBeInTheDocument();
  });

  it("hides search bar when searchVisible is false", () => {
    render(
      <FileListView
        entries={mockEntries}
        currentPath="/"
        searchVisible={false}
      />
    );
    expect(screen.queryByPlaceholderText("Filter files...")).not.toBeInTheDocument();
  });
});
