import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  CheckSquare,
  ClipboardCopy,
  ExternalLink,
  FilePlus,
  FolderOutput,
  FolderOpen,
  Lock,
  Pencil,
  Plus,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { DetailPanel } from "./components/detail-panel/DetailPanel";
import { CreateArchiveDialog } from "./components/dialogs/CreateArchiveDialog";
import { ExtractDialog } from "./components/dialogs/ExtractDialog";
import { FileListSkeleton } from "./components/file-list/FileListSkeleton";
import { PasswordDialog } from "./components/dialogs/PasswordDialog";
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { FileListView } from "./components/file-list/FileListView";
import { FileTree } from "./components/file-tree/FileTree";
import { HistoryPanel } from "./components/layout/HistoryPanel";
import { WelcomeView } from "./components/WelcomeView";
import { StatusBar } from "./components/layout/StatusBar";
import { TitleBar } from "./components/layout/TitleBar";
import { Toolbar } from "./components/layout/Toolbar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./components/ui/context-menu";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useUpdater } from "./hooks/useUpdater";
import { useBreathingPulse } from "./lib/animations";
import { formatFileSize } from "./lib/format";
import { useArchiveStore, type ArchiveEntry } from "./store/archiveStore";

function App() {
  const {
    currentArchive,
    entries,
    totalSize,
    compressedSize,
    format,
    encrypted,
    health,
    isLoading,
    error,
    selectedEntry,
    selectedEntries,
    currentPath,
    needsPassword,
    setSelectedEntry,
    setCurrentPath,
    openArchive,
    clearError,
    extractArchiveHere,
    extractArchiveToFolder,
    extractArchiveWithPassword,
    setNeedsPassword,
    toggleEntrySelection,
    selectAll,
    deselectAll,
    getSelectedEntries,
    loadHistory,
    loadSettings,
  } = useArchiveStore();

  useEffect(() => {
    if (error) {
      toast.error(error, {
        action: {
          label: "Copy",
          onClick: () => navigator.clipboard.writeText(error),
        },
      });
      clearError();
    }
  }, [error, clearError]);

  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogSources, setCreateDialogSources] = useState<string[] | undefined>(undefined);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isTreeOpen, setIsTreeOpen] = useState(true);

  useUpdater();

  useEffect(() => {
    loadHistory();
    loadSettings();
  }, [loadHistory, loadSettings]);

  // Listen for CLI --open event (when launched from Explorer or second instance)
  useEffect(() => {
    const unlisten = listen<string>("cli-open", (event) => {
      openArchive(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [openArchive]);

  // Consume pending CLI path on mount (first instance, --open or --smart-extract)
  useEffect(() => {
    invoke<string | null>("get_pending_open").then((path) => {
      if (path) {
        openArchive(path);
      }
    });
  }, [openArchive]);

  useEffect(() => {
    if (!settingsDialogOpen) {
      loadSettings();
    }
  }, [settingsDialogOpen, loadSettings]);

  const isZipArchive = format === "zip";

  const handleExtractComplete = async (dest: string) => {
    // Auto-open the destination folder
    try {
      await openPath(dest);
    } catch {
      // Fallback: show toast if auto-open fails
      toast.success("Extracted successfully", {
        description: dest,
        duration: 6000,
      });
    }
  };

  const handleQuickExtract = async () => {
    if (!currentArchive) return;
    // Disk space pre-check
    const { checkDiskSpace, totalSize } = useArchiveStore.getState();
    const parent = currentArchive.includes("\\")
      ? currentArchive.substring(0, currentArchive.lastIndexOf("\\"))
      : currentArchive.includes("/")
        ? currentArchive.substring(0, currentArchive.lastIndexOf("/"))
        : "";
    if (parent) {
      const available = await checkDiskSpace(parent);
      if (available > 0 && totalSize > available) {
        toast.warning("Low disk space", {
          description: `Need ${formatFileSize(totalSize)}, only ${formatFileSize(available)} free. Extracting anyway...`,
          duration: 5000,
        });
      }
    }
    const archiveName = currentArchive.split("\\").pop()?.split("/").pop() ?? "archive";
    let folderName = archiveName;
    if (folderName.toLowerCase().endsWith(".tar.gz")) {
      folderName = folderName.slice(0, -7);
    } else {
      const dotIndex = folderName.lastIndexOf(".");
      if (dotIndex > 0) folderName = folderName.slice(0, dotIndex);
    }
    const loadingId = toast.loading(`Extracting to ${folderName}…`);
    const dest = await extractArchiveToFolder();
    toast.dismiss(loadingId);
    const { error, needsPassword } = useArchiveStore.getState();
    if (!error && !needsPassword && dest) {
      handleExtractComplete(dest);
    }
  };

  const handleExtractHere = async () => {
    const loadingId = toast.loading("Extracting here…");
    await extractArchiveHere();
    toast.dismiss(loadingId);
    const { error, needsPassword } = useArchiveStore.getState();
    if (!error && !needsPassword) {
      toast.success("Extracted successfully", {
        description: "Files extracted to archive location",
        duration: 4000,
      });
    }
  };

  const handleDeleteEntries = async () => {
    if (!currentArchive || !isZipArchive) return;
    const selected = getSelectedEntries();
    if (selected.length === 0 && selectedEntry) {
      selected.push(selectedEntry);
    }
    const paths = selected.map((e) => e.path);
    try {
      await invoke("remove_from_archive", { path: currentArchive, entryPaths: paths });
      await openArchive(currentArchive);
    } catch (err) {
      console.error("Failed to delete entries:", err);
    }
  };

  const handleAddToArchive = async () => {
    if (!currentArchive || !isZipArchive) return;
    try {
      const selected = await openDialog({ multiple: true, title: "Select files to add" });
      if (selected) {
        const sources = Array.isArray(selected) ? selected : [selected];
        await invoke("add_to_archive", { archivePath: currentArchive, sources });
        await openArchive(currentArchive);
      }
    } catch (err) {
      console.error("Failed to add files:", err);
    }
  };

  const handleRenameEntry = async () => {
    if (!currentArchive || !selectedEntry || !isZipArchive) return;
    const newName = prompt("Enter new name:", selectedEntry.name);
    if (newName && newName !== selectedEntry.name) {
      try {
        await invoke("rename_in_archive", {
          path: currentArchive,
          entryPath: selectedEntry.path,
          newName,
        });
        await openArchive(currentArchive);
      } catch (err) {
        console.error("Failed to rename entry:", err);
      }
    }
  };

  const handleEntryDoubleClick = async (entry: ArchiveEntry) => {
    if (!currentArchive || entry.isDirectory) return;
    try {
      const filePath = await invoke<string>("extract_single_file", {
        path: currentArchive,
        entryPath: entry.path,
      });
      await openPath(filePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to open "${entry.name}"`, { description: msg });
    }
  };

  const dragIconRef = useRef<SVGSVGElement>(null);
  useBreathingPulse(dragIconRef, { active: isDragOver });

  const shortcuts = useMemo(
    () => ({
      "ctrl+e": () => {
        if (currentArchive) handleQuickExtract();
      },
      "ctrl+n": () => {
        setCreateDialogOpen(true);
      },
      "ctrl+a": () => {
        if (currentArchive && entries.length > 0) selectAll();
      },
      "ctrl+f": () => {
        if (currentArchive) setIsSearchActive((prev) => !prev);
      },
      "ctrl+b": () => {
        if (currentArchive) setIsTreeOpen((prev) => !prev);
      },
      escape: () => {
        setExtractDialogOpen(false);
        setCreateDialogOpen(false);
        setIsHistoryOpen(false);
        deselectAll();
      },
    }),
    [currentArchive, entries, selectAll, deselectAll],
  );

  useKeyboardShortcuts(shortcuts);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    appWindow
      .onDragDropEvent((event) => {
        if (event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);
          const paths = event.payload.paths;
          if (paths.length > 0) {
            const filePath = paths[0];
            const ext = filePath.split(".").pop()?.toLowerCase();
            const supportedExtensions = [
              "zip", "tar", "gz", "tgz", "7z", "rar",
              "br", "zst",
            ];
            const isSupported =
              supportedExtensions.includes(ext || "") ||
              filePath.toLowerCase().endsWith(".tar.gz") ||
              filePath.toLowerCase().endsWith(".tgz");
            if (isSupported) {
              openArchive(filePath);
            } else {
              setCreateDialogSources(paths);
              setCreateDialogOpen(true);
            }
          }
        } else {
          setIsDragOver(false);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const archiveTotalSize = totalSize;
  const archiveCompressedSize = compressedSize;

  const archiveName = currentArchive?.split("\\").pop()?.split("/").pop() ?? null;

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <TitleBar />

        <Toolbar
          archiveName={archiveName}
          format={format}
          hasArchive={!!currentArchive}
          isLoading={isLoading}
          isSearchActive={isSearchActive}
          isTreeOpen={isTreeOpen}
          onToggleSearch={() => setIsSearchActive((prev) => !prev)}
          onToggleTree={() => setIsTreeOpen((prev) => !prev)}
          onExtract={(e) => {
            if (!currentArchive) return;
            if (e?.altKey) {
              setExtractDialogOpen(true);
            } else {
              handleQuickExtract();
            }
          }}
          onCreate={() => setCreateDialogOpen(true)}
          onToggleHistory={() => setIsHistoryOpen((prev) => !prev)}
          onSettings={() => setSettingsDialogOpen(true)}
          isHistoryOpen={isHistoryOpen}
        />

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {isLoading ? (
            <FileListSkeleton />
          ) : !currentArchive ? (
            <WelcomeView onCreate={() => setCreateDialogOpen(true)} />
          ) : encrypted && entries.length === 0 ? (
            <EncryptedState onExtract={() => setExtractDialogOpen(true)} />
          ) : (
            <>
              {isTreeOpen && (
                <FileTree
                  entries={entries}
                  currentPath={currentPath}
                  onNavigate={setCurrentPath}
                  onFileSelect={setSelectedEntry}
                />
              )}
              <ContextMenu>
                <ContextMenuTrigger
                  render={
                    <div className="flex flex-1 flex-col overflow-hidden" />
                  }
                >
                  <FileListView
                    entries={entries}
                    currentPath={currentPath}
                    onNavigate={setCurrentPath}
                    onEntrySelect={setSelectedEntry}
                    onEntryMultiSelect={toggleEntrySelection}
                    onEntryDoubleClick={handleEntryDoubleClick}
                    onEntryDelete={isZipArchive ? handleDeleteEntries : undefined}
                    selectedEntries={selectedEntries}
                    searchVisible={isSearchActive}
                    onSearchClose={() => setIsSearchActive(false)}
                    pinnedEntry={selectedEntry}
                  />
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuGroup>
                    <ContextMenuItem
                      disabled={!currentArchive}
                      onClick={handleQuickExtract}
                    >
                      <FolderOutput className="mr-2 h-4 w-4" />
                      Extract to Folder
                      <span className="ml-auto text-[10px] tracking-widest text-muted-foreground/40">Ctrl+E</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!currentArchive}
                      onClick={handleExtractHere}
                    >
                      <FolderOutput className="mr-2 h-4 w-4" />
                      Extract Here
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!currentArchive}
                      onClick={() => setExtractDialogOpen(true)}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      {selectedEntries.size > 1
                        ? `Extract selected (${selectedEntries.size} files) to...`
                        : "Extract to..."}
                    </ContextMenuItem>
                  </ContextMenuGroup>
                  <ContextMenuSeparator />
                  <ContextMenuGroup>
                    <ContextMenuItem onClick={() => setCreateDialogOpen(true)}>
                      <FilePlus className="mr-2 h-4 w-4" />
                      Create Archive...
                      <span className="ml-auto text-[10px] tracking-widest text-muted-foreground/40">Ctrl+N</span>
                    </ContextMenuItem>
                    {isZipArchive && (
                      <ContextMenuItem onClick={handleAddToArchive}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Files to Archive...
                      </ContextMenuItem>
                    )}
                  </ContextMenuGroup>
                  <ContextMenuSeparator />
                  <ContextMenuGroup>
                    <ContextMenuItem disabled={!selectedEntry} onClick={() => selectedEntry && handleEntryDoubleClick(selectedEntry)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                      <span className="ml-auto text-[10px] tracking-widest text-muted-foreground/40">Enter</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!selectedEntry}
                      onClick={() => {
                        if (selectedEntry) {
                          navigator.clipboard.writeText(selectedEntry.path);
                          toast.success("Path copied");
                        }
                      }}
                    >
                      <ClipboardCopy className="mr-2 h-4 w-4" />
                      Copy Path
                    </ContextMenuItem>
                  </ContextMenuGroup>
                  {isZipArchive && selectedEntry && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuGroup>
                        <ContextMenuItem onClick={handleRenameEntry}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Rename
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={handleDeleteEntries}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                          <span className="ml-auto text-[10px] tracking-widest text-muted-foreground/40">Del</span>
                        </ContextMenuItem>
                      </ContextMenuGroup>
                    </>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuGroup>
                    <ContextMenuItem
                      disabled={!currentArchive || entries.length === 0}
                      onClick={selectAll}
                    >
                      <CheckSquare className="mr-2 h-4 w-4" />
                      Select All
                      <span className="ml-auto text-[10px] tracking-widest text-muted-foreground/40">Ctrl+A</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={selectedEntries.size === 0}
                      onClick={deselectAll}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Deselect All
                    </ContextMenuItem>
                  </ContextMenuGroup>
                </ContextMenuContent>
              </ContextMenu>

              {/* Detail Panel -- contextual, only when entry selected */}
              {selectedEntry && (
                <DetailPanel
                  entry={selectedEntry}
                  totalEntries={entries.length}
                  totalSize={archiveTotalSize}
                  compressedSize={archiveCompressedSize}
                  format={format ?? undefined}
                  onOpenEntry={handleEntryDoubleClick}
                  onExtractEntry={(entry) => {
                    setSelectedEntry(entry);
                    setExtractDialogOpen(true);
                  }}
                  onClose={() => setSelectedEntry(null)}
                />
              )}
            </>
          )}
        </div>

        <StatusBar
          status={isLoading ? "Loading..." : undefined}
          itemCount={entries.length}
          totalSize={entries.length > 0 ? formatFileSize(archiveTotalSize) : undefined}
          encrypted={encrypted}
          selectedCount={selectedEntries.size}
          health={health}
        />

        <ExtractDialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen} />
        <CreateArchiveDialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) setCreateDialogSources(undefined);
          }}
          initialSources={createDialogSources}
        />
        <PasswordDialog
          open={needsPassword}
          onOpenChange={(open) => setNeedsPassword(open)}
          onSubmit={extractArchiveWithPassword}
          filename={archiveName ?? undefined}
        />
        <SettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
        />

        <HistoryPanel
          open={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />

        {isDragOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md transition-all">
            <div className="drag-border-glow flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-20 py-14">
              <Upload ref={dragIconRef} className="h-10 w-10 text-primary/50" />
              <div className="text-center">
                <p className="text-[13px] font-medium text-primary/70">
                  Drop to open or create archive
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/40">
                  Archives will be opened, other files will be compressed
                </p>
              </div>
            </div>
          </div>
        )}

        <Toaster />
      </div>
    </TooltipProvider>
  );
}

function EncryptedState({ onExtract }: { onExtract: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
        <Lock className="h-7 w-7 text-muted-foreground/25" strokeWidth={1.5} />
      </div>
      <div className="text-center flex flex-col gap-1.5">
        <p className="text-[15px] font-medium text-foreground/50">Encrypted Archive</p>
        <p className="text-[12px] text-muted-foreground/30">
          Password protected. Extract to continue.
        </p>
      </div>
      <button
        onClick={onExtract}
        className="inline-flex items-center gap-2 rounded-lg bg-primary/90 px-5 py-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary active:scale-[0.98] transition-all"
      >
        <FolderOutput className="h-3.5 w-3.5" />
        Extract Archive
      </button>
    </div>
  );
}

export default App;
