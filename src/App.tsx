import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DetailPanel } from "./components/detail-panel/DetailPanel";
import { ExtractDialog } from "./components/dialogs/ExtractDialog";
import { FileListView } from "./components/file-list/FileListView";
import { Sidebar } from "./components/layout/Sidebar";
import { StatusBar } from "./components/layout/StatusBar";
import { TitleBar } from "./components/layout/TitleBar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./components/ui/context-menu";
import { TooltipProvider } from "./components/ui/tooltip";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useArchiveStore } from "./store/archiveStore";

function App() {
  const {
    currentArchive,
    entries,
    totalSize,
    compressedSize,
    format,
    isLoading,
    error,
    selectedEntry,
    currentPath,
    setSelectedEntry,
    setCurrentPath,
    openArchive,
    clearError,
  } = useArchiveStore();

  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Keyboard shortcuts
  const shortcuts = useMemo(
    () => ({
      "ctrl+e": () => {
        if (currentArchive) setExtractDialogOpen(true);
      },
      escape: () => {
        setExtractDialogOpen(false);
      },
    }),
    [currentArchive],
  );

  useKeyboardShortcuts(shortcuts);

  // Handle Tauri native file drop
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
            if (["zip"].includes(ext || "")) {
              openArchive(filePath);
            }
          }
        } else {
          // cancelled
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

  // Calculate totals
  const archiveTotalSize = totalSize || entries.reduce((acc, entry) => acc + entry.size, 0);
  const archiveCompressedSize =
    compressedSize ||
    entries.reduce((acc, entry) => acc + (entry.compressedSize || entry.size), 0);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        {/* Custom Title Bar */}
        <TitleBar />

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <Sidebar />

          {/* File List */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {error && (
              <div className="flex items-center justify-between border-b bg-destructive/10 px-4 py-2 text-destructive">
                <span className="text-sm">{error}</span>
                <button
                  onClick={clearError}
                  className="text-xs underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            ) : !currentArchive ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg font-medium">No archive open</p>
                  <p className="text-sm">
                    Drop an archive file here or use File → Open
                  </p>
                </div>
              </div>
            ) : (
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <FileListView
                      entries={entries}
                      currentPath={currentPath}
                      onNavigate={setCurrentPath}
                      onEntrySelect={setSelectedEntry}
                      onEntryDoubleClick={(entry) => {
                        console.log("Open entry:", entry);
                      }}
                    />
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    disabled={!currentArchive}
                    onClick={() => setExtractDialogOpen(true)}
                  >
                    Extract to...
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem disabled={!selectedEntry}>
                    Open
                  </ContextMenuItem>
                  <ContextMenuItem disabled={!selectedEntry}>
                    Preview
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem disabled>Select All</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )}
          </div>

          {/* Detail Panel */}
          <DetailPanel
            entry={selectedEntry}
            totalEntries={entries.length}
            totalSize={archiveTotalSize}
            compressedSize={archiveCompressedSize}
          />
        </div>

        {/* Status Bar */}
        <StatusBar
          status={
            isLoading
              ? "Loading..."
              : currentArchive
                ? `Ready - ${format || "Unknown"} archive`
                : "Ready"
          }
          itemCount={entries.length}
          totalSize={entries.length > 0 ? formatSize(archiveTotalSize) : undefined}
        />

        {/* Extract Dialog */}
        <ExtractDialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen} />

        {/* Drag Overlay */}
        {isDragOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-foreground/30 px-16 py-12">
              <svg
                className="h-10 w-10 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16"
                />
              </svg>
              <p className="text-sm font-medium text-muted-foreground">
                Drop archive here
              </p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default App;
