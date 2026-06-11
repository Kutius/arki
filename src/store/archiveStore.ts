import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface ArchiveEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  compressedSize?: number;
  modified?: string;
}

export interface ArchiveInfo {
  entries: ArchiveEntry[];
  totalSize: number;
  compressedSize: number;
  format: string;
}

interface ArchiveState {
  // Archive info
  currentArchive: string | null;
  entries: ArchiveEntry[];
  totalSize: number;
  compressedSize: number;
  format: string | null;

  // UI state
  isLoading: boolean;
  error: string | null;
  selectedEntry: ArchiveEntry | null;
  currentPath: string;

  // Actions
  openArchive: (path: string) => Promise<void>;
  closeArchive: () => void;
  setSelectedEntry: (entry: ArchiveEntry | null) => void;
  setCurrentPath: (path: string) => void;
  extractArchive: (destination: string, overwrite?: boolean) => Promise<void>;
  clearError: () => void;
}

export const useArchiveStore = create<ArchiveState>((set, get) => ({
  // Initial state
  currentArchive: null,
  entries: [],
  totalSize: 0,
  compressedSize: 0,
  format: null,
  isLoading: false,
  error: null,
  selectedEntry: null,
  currentPath: "/",

  // Open archive
  openArchive: async (path: string) => {
    set({ isLoading: true, error: null });

    try {
      const info = (await invoke("list_archive", { path })) as ArchiveInfo;

      set({
        currentArchive: path,
        entries: info.entries,
        totalSize: info.totalSize,
        compressedSize: info.compressedSize,
        format: info.format,
        isLoading: false,
        currentPath: "/",
        selectedEntry: null,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // Close archive
  closeArchive: () => {
    set({
      currentArchive: null,
      entries: [],
      totalSize: 0,
      compressedSize: 0,
      format: null,
      selectedEntry: null,
      currentPath: "/",
    });
  },

  // Set selected entry
  setSelectedEntry: (entry: ArchiveEntry | null) => {
    set({ selectedEntry: entry });
  },

  // Set current path
  setCurrentPath: (path: string) => {
    set({ currentPath: path, selectedEntry: null });
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

      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
