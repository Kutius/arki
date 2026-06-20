import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useArchiveStore } from "../../store/archiveStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AlertCircle, Archive, Check, Folder, FolderOpen, Gauge, Plus, X, Zap, HardDrive, Feather } from "lucide-react";
import { cn } from "../../lib/utils";
import { getParentPath } from "../../lib/path";
import { FileIcon } from "../../lib/fileIcons";
import { OperationProgress } from "../ui/operation-progress";

interface CreateArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSources?: string[];
}

interface SourceItem {
  path: string;
  isDirectory: boolean;
}

const FORMAT_OPTIONS = [
  { value: "zip", label: "ZIP", description: "Most compatible" },
  { value: "tar.gz", label: "TAR.GZ", description: "Unix standard" },
] as const;

const COMPRESSION_LEVELS = [
  { value: 0, label: "Store", description: "No compression", icon: HardDrive },
  { value: 1, label: "Fastest", description: "Minimal compression", icon: Zap },
  { value: 6, label: "Normal", description: "Balanced", icon: Gauge },
  { value: 9, label: "Best", description: "Maximum compression", icon: Feather },
] as const;

export function CreateArchiveDialog({
  open: isOpen,
  onOpenChange,
  initialSources,
}: CreateArchiveDialogProps) {
  const { settings, loadSettings, createProgress, cancelOperation } = useArchiveStore();
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [format, setFormat] = useState<string>("zip");
  const [compressionLevel, setCompressionLevel] = useState<number>(6);
  const [destination, setDestination] = useState<string>("");
  const [filename, setFilename] = useState<string>("archive.zip");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount if not already loaded
  useEffect(() => {
    if (!settings) {
      loadSettings();
    }
  }, [settings, loadSettings]);

  // Reset form when dialog opens, using default compression level from settings
  useEffect(() => {
    if (isOpen && !initialSources) {
      setSources([]);
      setFilename("archive.zip");
      setError(null);
      setCompressionLevel(settings?.default_compression_level ?? 6);
    }
  }, [isOpen, initialSources, settings]);

  // Pre-fill sources from drag-drop
  useEffect(() => {
    if (isOpen && initialSources && initialSources.length > 0) {
      const newSources: SourceItem[] = initialSources.map((p) => ({
        path: p,
        isDirectory: false,
      }));
      setSources(newSources);
      // Derive archive name from first source
      const firstName = initialSources[0].split("\\").pop()?.split("/").pop() || "archive";
      const baseName = firstName.replace(/\.[^.]+$/, "");
      setFilename(`${baseName}.zip`);
      // Derive default destination from first source's parent directory
      if (!destination) {
        const parent = getParentPath(initialSources[0]);
        if (parent) setDestination(parent);
      }
    }
  }, [isOpen, initialSources]);

  const handleAddFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        title: "Select files to add",
      });
      if (selected) {
        const newSources = Array.isArray(selected)
          ? selected.map((p) => ({ path: p, isDirectory: false }))
          : [{ path: selected, isDirectory: false }];
        setSources((prev) => [...prev, ...newSources]);
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  };

  const handleAddFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        title: "Select folder to add",
      });
      if (selected) {
        const newSources = Array.isArray(selected)
          ? selected.map((p) => ({ path: p, isDirectory: true }))
          : [{ path: selected, isDirectory: true }];
        setSources((prev) => [...prev, ...newSources]);
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
    }
  };

  const handleSelectDestination = async () => {
    try {
      const selected = await open({
        directory: true,
        title: "Select destination folder",
      });
      if (selected) {
        setDestination(Array.isArray(selected) ? selected[0] : selected);
      }
    } catch (err) {
      console.error("Failed to open destination dialog:", err);
    }
  };

  const handleRemoveSource = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (sources.length === 0) {
      setError("Please add at least one file or folder");
      return;
    }
    if (!destination) {
      setError("Please select a destination folder");
      return;
    }
    if (!filename) {
      setError("Please enter a filename");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const destPath = `${destination}\\${filename}`;
      await invoke("create_archive", {
        sources: sources.map((s) => s.path),
        destination: destPath,
        format,
        compressionLevel,
      });

      // Reset form and close
      setSources([]);
      setDestination("");
      setFilename("archive.zip");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleFormatChange = (newFormat: string) => {
    setFormat(newFormat);
    // Update filename extension
    const baseName = filename.replace(/\.(zip|tar\.gz)$/, "");
    setFilename(`${baseName}.${newFormat}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary/80" />
            Create Archive
          </DialogTitle>
          <DialogDescription>
            Select files and folders to compress into an archive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Files */}
          <div className="space-y-2">
            <Label>Source Files & Folders</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddFiles}
                disabled={isCreating}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Files
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddFolder}
                disabled={isCreating}
              >
                <Folder className="mr-1 h-4 w-4" />
                Add Folder
              </Button>
            </div>

            {sources.length > 0 && (
              <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
                {sources.map((source, index) => (
                  <div
                    key={index}
                    className="group flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {source.isDirectory ? (
                        <Folder className="h-4 w-4 shrink-0 text-blue-400/70" />
                      ) : (
                        <SourceFileIcon path={source.path} />
                      )}
                      <span className="truncate text-[13px]">
                        {source.path.split("\\").pop()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveSource(index)}
                      className="ml-2 rounded p-0.5 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleFormatChange(option.value)}
                  disabled={isCreating}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-1 rounded-md border p-3 text-sm transition-all",
                    format === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted",
                  )}
                >
                  {format === option.value && (
                    <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                  <Archive className="h-5 w-5" />
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Compression Level */}
          <div className="space-y-2">
            <Label>Compression Level</Label>
            <div className="flex gap-2">
              {COMPRESSION_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setCompressionLevel(level.value)}
                  disabled={isCreating}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-1 rounded-md border p-2 text-sm transition-all",
                    compressionLevel === level.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted",
                  )}
                >
                  {compressionLevel === level.value && (
                    <div className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-2 w-2 text-primary-foreground" />
                    </div>
                  )}
                  <level.icon className="h-4 w-4" />
                  <span className="font-medium">{level.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {level.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label>Destination</Label>
            <div className="flex gap-2">
              <Input
                value={destination}
                placeholder="Select destination folder..."
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleSelectDestination}
                disabled={isCreating}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filename */}
          <div className="space-y-2">
            <Label>Filename</Label>
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="archive.zip"
              disabled={isCreating}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Progress */}
          {isCreating && createProgress && (
            <OperationProgress
              currentFile={createProgress.current_file}
              filesProcessed={createProgress.files_processed}
              totalFiles={createProgress.total_files}
              bytesProcessed={createProgress.bytes_written}
              totalBytes={createProgress.total_bytes}
              onCancel={cancelOperation}
              cancelLabel="Cancel Creation"
            />
          )}
        </div>

        <DialogFooter>
          {!isCreating && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="active:scale-[0.98]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={sources.length === 0 || !destination}
                className="active:scale-[0.98]"
              >
                Create Archive
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceFileIcon({ path }: { path: string }) {
  const name = path.split("\\").pop()?.split("/").pop() || path;
  return <FileIcon name={name} />;
}
