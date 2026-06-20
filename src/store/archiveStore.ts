import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getPreviewType, type PreviewType } from "../lib/format";
import { getParentPath } from "../lib/path";

interface ExtractProgress {
  current_file: string;
  files_processed: number;
  total_files: number;
  bytes_processed: number;
  total_bytes: number;
}

interface CreateProgress {
  current_file: string;
  files_processed: number;
  total_files: number;
  bytes_written: number;
  total_bytes: number;
}

export interface HistoryEntry {
  path: string;
  name: string;
  format: string;
  last_opened: string;
  is_favorite: boolean;
}

export type { PreviewType };

export interface AppSettings {
  default_extract_path: string | null;
  default_compression_level: number;
  theme: string;
}

export interface ArchiveEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  compressedSize?: number;
  modified?: string;
  mimeType?: string;
}

export interface ArchiveInfo {
  entries: ArchiveEntry[];
  totalSize: number;
  compressedSize: number;
  format: string;
  encrypted: boolean;
}

interface ArchiveState {
  // Archive info
  currentArchive: string | null;
  entries: ArchiveEntry[];
  totalSize: number;
  compressedSize: number;
  format: string | null;
  encrypted: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;
  selectedEntry: ArchiveEntry | null;
  currentPath: string;
  needsPassword: boolean;
  pendingExtractDestination: string | null;

  // Preview state
  previewContent: string | null;
  previewImageUrl: string | null;
  previewType: PreviewType;
  isLoadingPreview: boolean;

  // Multi-select state
  selectedEntries: Set<string>;  // entry.path set

  // Progress state
  extractProgress: ExtractProgress | null;
  createProgress: CreateProgress | null;

  // History state
  history: HistoryEntry[];

  // Settings state
  settings: AppSettings | null;

  // Actions
  openArchive: (path: string) => Promise<void>;
  closeArchive: () => void;
  setSelectedEntry: (entry: ArchiveEntry | null) => void;
  setCurrentPath: (path: string) => void;
  extractArchive: (destination: string, overwrite?: boolean) => Promise<void>;
  extractArchiveHere: () => Promise<void>;
  extractArchiveToFolder: () => Promise<void>;
  extractArchiveWithPassword: (password: string) => Promise<void>;
  getDefaultExtractDestination: () => string;
  clearError: () => void;
  setNeedsPassword: (needs: boolean, destination?: string) => void;
  loadPreview: (entry: ArchiveEntry) => Promise<void>;
  clearPreview: () => void;
  toggleEntrySelection: (entry: ArchiveEntry, additive: boolean) => void;
  selectAll: () => void;
  deselectAll: () => void;
  getSelectedEntries: () => ArchiveEntry[];
  loadHistory: () => Promise<void>;
  removeFromHistory: (path: string) => Promise<void>;
  toggleFavorite: (path: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  cancelOperation: () => Promise<void>;
}

/** Apply theme to <html> and Tauri window. Exported so SettingsDialog can call it directly. */
export function applyTheme(theme: string) {
  const root = document.documentElement;
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  root.classList.remove("dark", "light");
  root.classList.add(resolved);
  root.setAttribute("data-theme", resolved);

  // Sync Tauri window theme — this controls the webview's native appearance
  try {
    const appWindow = getCurrentWindow();
    appWindow.setTheme(resolved === "dark" ? "dark" : "light");
  } catch {
    // setTheme may not be available in all environments
  }
}

let progressUnlisten: UnlistenFn | null = null;

export const useArchiveStore = create<ArchiveState>((set, get) => ({
  // Initial state
  currentArchive: null,
  entries: [],
  totalSize: 0,
  compressedSize: 0,
  format: null,
  encrypted: false,
  isLoading: false,
  error: null,
  selectedEntry: null,
  currentPath: "/",
  needsPassword: false,
  pendingExtractDestination: null,

  // Preview state
  previewContent: null,
  previewImageUrl: null,
  previewType: null,
  isLoadingPreview: false,

  // Multi-select state
  selectedEntries: new Set<string>(),

  // Progress state
  extractProgress: null,
  createProgress: null,

  // History state
  history: [],

  // Settings state
  settings: null,

  // Open archive
  openArchive: async (path: string) => {
    set({ isLoading: true, error: null });

    // Register progress listeners
    if (!progressUnlisten) {
      const appWindow = getCurrentWindow();
      Promise.all([
        appWindow.listen("extract-progress", (event) => {
          set({ extractProgress: event.payload as ExtractProgress });
        }),
        appWindow.listen("create-progress", (event) => {
          set({ createProgress: event.payload as CreateProgress });
        }),
      ]).then(([unlistenExtract, unlistenCreate]) => {
        progressUnlisten = () => {
          unlistenExtract();
          unlistenCreate();
        };
      });
    }

    try {
      const info = (await invoke("list_archive", { path })) as ArchiveInfo;

      set({
        currentArchive: path,
        entries: info.entries,
        totalSize: info.totalSize,
        compressedSize: info.compressedSize,
        format: info.format,
        encrypted: info.encrypted,
        isLoading: false,
        currentPath: "/",
        selectedEntry: null,
        selectedEntries: new Set(),
        extractProgress: null,
      });

      // Add to history
      const fileName = path.split("\\").pop()?.split("/").pop() || path;
      invoke("add_to_history", {
        path,
        name: fileName,
        format: info.format,
      }).then(() => get().loadHistory());
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // Close archive
  closeArchive: () => {
    // Cleanup progress listener
    if (progressUnlisten) {
      progressUnlisten();
      progressUnlisten = null;
    }

    set({
      currentArchive: null,
      entries: [],
      totalSize: 0,
      compressedSize: 0,
      format: null,
      encrypted: false,
      selectedEntry: null,
      currentPath: "/",
      extractProgress: null,
    });
  },

  // Set selected entry (single select, clears multi-select)
  setSelectedEntry: (entry: ArchiveEntry | null) => {
    set({ selectedEntry: entry, selectedEntries: new Set() });
    if (entry && !entry.isDirectory) {
      get().loadPreview(entry);
    } else {
      get().clearPreview();
    }
  },

  // Set current path
  setCurrentPath: (path: string) => {
    set({ currentPath: path, selectedEntry: null });
  },

  // Get default extract destination from settings or archive path
  getDefaultExtractDestination: () => {
    const { settings, currentArchive } = get();
    if (settings?.default_extract_path) {
      return settings.default_extract_path;
    }
    if (currentArchive) {
      return getParentPath(currentArchive);
    }
    return "";
  },

  // Extract archive
  extractArchive: async (destination: string, overwrite = false) => {
    const { currentArchive } = get();

    if (!currentArchive) {
      set({ error: "No archive is currently open" });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await invoke("extract_archive", {
        path: currentArchive,
        destination,
        overwrite,
      });

      set({ isLoading: false, extractProgress: null });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const lowerMsg = errorMsg.toLowerCase();

      // Check if the error is password-related
      const isPasswordError =
        lowerMsg.includes("password") ||
        lowerMsg.includes("encrypted") ||
        lowerMsg.includes("decrypt") ||
        lowerMsg.includes("aes256") ||
        lowerMsg.includes("unsupportedcompressionmethod");

      if (isPasswordError) {
        set({
          isLoading: false,
          extractProgress: null,
          needsPassword: true,
          pendingExtractDestination: destination,
        });
      } else {
        set({
          isLoading: false,
          extractProgress: null,
          error: errorMsg,
        });
      }
    }
  },

  // Extract here: extract to the archive's parent directory
  extractArchiveHere: async () => {
    const { currentArchive } = get();
    if (!currentArchive) {
      set({ error: "No archive is currently open" });
      return;
    }
    const destination = getParentPath(currentArchive);
    await get().extractArchive(destination);
  },

  // Extract to folder: extract to a subfolder named after the archive
  extractArchiveToFolder: async () => {
    const { currentArchive } = get();
    if (!currentArchive) {
      set({ error: "No archive is currently open" });
      return;
    }
    const parent = getParentPath(currentArchive);
    const archiveName = currentArchive.split("\\").pop()?.split("/").pop() ?? "extracted";
    // Remove extension(s)
    let folderName = archiveName;
    if (folderName.toLowerCase().endsWith(".tar.gz")) {
      folderName = folderName.slice(0, -7);
    } else {
      const dotIndex = folderName.lastIndexOf(".");
      if (dotIndex > 0) {
        folderName = folderName.slice(0, dotIndex);
      }
    }
    const destination = parent ? `${parent}/${folderName}` : folderName;
    await get().extractArchive(destination);
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Set needs password
  setNeedsPassword: (needs: boolean, destination?: string) => {
    set({
      needsPassword: needs,
      pendingExtractDestination: destination || null,
    });
  },

  // Extract archive with password
  extractArchiveWithPassword: async (password: string) => {
    const { currentArchive, pendingExtractDestination } = get();

    if (!currentArchive || !pendingExtractDestination) {
      set({ error: "No archive or destination set" });
      return;
    }

    set({ isLoading: true, error: null, needsPassword: false });

    try {
      await invoke("extract_archive_with_password", {
        path: currentArchive,
        destination: pendingExtractDestination,
        overwrite: false,
        password,
      });

      set({
        isLoading: false,
        extractProgress: null,
        pendingExtractDestination: null,
      });
    } catch (err) {
      set({
        isLoading: false,
        extractProgress: null,
        pendingExtractDestination: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // Load preview for selected entry
  loadPreview: async (entry: ArchiveEntry) => {
    const { currentArchive } = get();
    if (!currentArchive || entry.isDirectory) return;

    // Max preview size: 10MB
    if (entry.size > 10 * 1024 * 1024) {
      set({
        previewContent: null,
        previewImageUrl: null,
        previewType: null,
        isLoadingPreview: false,
      });
      return;
    }

    const previewType = getPreviewType(entry.name);
    if (!previewType) {
      set({
        previewContent: null,
        previewImageUrl: null,
        previewType: null,
        isLoadingPreview: false,
      });
      return;
    }

    set({ isLoadingPreview: true });

    try {
      const base64 = (await invoke("preview_file", {
        path: currentArchive,
        entryPath: entry.path,
      })) as string;

      if (previewType === "image") {
        const ext = entry.name.split(".").pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
          svg: "image/svg+xml",
          bmp: "image/bmp",
          ico: "image/x-icon",
        };
        const mime = mimeMap[ext || ""] || "application/octet-stream";
        set({
          previewImageUrl: `data:${mime};base64,${base64}`,
          previewContent: null,
          previewType: "image",
          isLoadingPreview: false,
        });
      } else {
        const text = atob(base64);
        // Decode UTF-8
        const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0));
        const content = new TextDecoder("utf-8").decode(bytes);

        set({
          previewContent: content,
          previewImageUrl: null,
          previewType,
          isLoadingPreview: false,
        });
      }
    } catch (err) {
      console.error("Preview failed:", err);
      set({
        previewContent: null,
        previewImageUrl: null,
        previewType: null,
        isLoadingPreview: false,
      });
    }
  },

  // Clear preview
  clearPreview: () => {
    set({
      previewContent: null,
      previewImageUrl: null,
      previewType: null,
      isLoadingPreview: false,
    });
  },

  // Toggle entry selection (for multi-select with Ctrl/Shift)
  toggleEntrySelection: (entry: ArchiveEntry, additive: boolean) => {
    const { selectedEntries, selectedEntry, entries } = get();
    const newSet = new Set(selectedEntries);

    // If multi-select set is empty but we have a single selection, seed it
    if (newSet.size === 0 && selectedEntry) {
      newSet.add(selectedEntry.path);
    }

    if (additive) {
      // Ctrl+Click: toggle individual item
      if (newSet.has(entry.path)) {
        newSet.delete(entry.path);
      } else {
        newSet.add(entry.path);
      }
    } else {
      // Shift+Click: select range from last selected to current
      const lastSelected = get().selectedEntry;
      if (lastSelected) {
        const currentEntries = entries.filter((ent) => {
          // Same directory level
          const lastDir = lastSelected.path.includes("/")
            ? lastSelected.path.substring(0, lastSelected.path.lastIndexOf("/"))
            : "";
          const entryDir = ent.path.includes("/")
            ? entry.path.substring(0, entry.path.lastIndexOf("/"))
            : "";
          return lastDir === entryDir;
        });

        const lastIdx = currentEntries.findIndex(
          (e) => e.path === lastSelected.path,
        );
        const currentIdx = currentEntries.findIndex(
          (e) => e.path === entry.path,
        );

        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          for (let i = start; i <= end; i++) {
            newSet.add(currentEntries[i].path);
          }
        }
      } else {
        newSet.clear();
        newSet.add(entry.path);
      }
    }

    set({
      selectedEntries: newSet,
      selectedEntry: entry,
    });
  },

  // Select all entries
  selectAll: () => {
    const { entries } = get();
    const newSet = new Set(entries.map((e) => e.path));
    set({ selectedEntries: newSet });
  },

  // Deselect all
  deselectAll: () => {
    set({ selectedEntries: new Set() });
  },

  // Get selected entry objects
  getSelectedEntries: () => {
    const { entries, selectedEntries, selectedEntry } = get();
    if (selectedEntries.size > 0) {
      return entries.filter((e) => selectedEntries.has(e.path));
    }
    if (selectedEntry) {
      return [selectedEntry];
    }
    return [];
  },

  // Load history from disk
  loadHistory: async () => {
    try {
      const history = (await invoke("get_history")) as HistoryEntry[];
      set({ history });
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  },

  // Remove from history
  removeFromHistory: async (path: string) => {
    try {
      await invoke("remove_from_history", { path });
      await get().loadHistory();
    } catch (err) {
      console.error("Failed to remove from history:", err);
    }
  },

  // Toggle favorite
  toggleFavorite: async (path: string) => {
    try {
      await invoke("toggle_favorite", { path });
      await get().loadHistory();
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  },

  // Load settings and apply theme
  loadSettings: async () => {
    try {
      const settings = (await invoke("get_settings")) as AppSettings;
      set({ settings });
      applyTheme(settings.theme);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  },

  // Cancel current operation
  cancelOperation: async () => {
    try {
      await invoke("cancel_operation");
      set({ isLoading: false, extractProgress: null, createProgress: null });
    } catch (err) {
      console.error("Failed to cancel operation:", err);
    }
  },
}));
