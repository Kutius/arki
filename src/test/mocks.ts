/**
 * Mock implementations for Tauri APIs used in tests.
 * Import this file in test setup to avoid runtime errors.
 */

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

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn().mockResolvedValue(null),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  Toaster: () => null,
}));
