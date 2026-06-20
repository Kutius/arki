import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, FolderOutput, Lock } from "lucide-react";
import { useArchiveStore } from "../../store/archiveStore";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { OperationProgress } from "../ui/operation-progress";

interface ExtractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtractDialog({ open: isOpen, onOpenChange }: ExtractDialogProps) {
  const [destination, setDestination] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [password, setPassword] = useState("");
  const {
    extractArchive,
    extractArchiveWithPassword,
    cancelOperation,
    isLoading,
    currentArchive,
    encrypted,
    selectedEntries,
    getSelectedEntries,
    getDefaultExtractDestination,
    extractProgress,
  } = useArchiveStore();

  const selectedCount = selectedEntries.size;
  const hasSelection = selectedCount > 0;

  // Derive default destination from settings or archive path
  useEffect(() => {
    if (isOpen && currentArchive && !destination) {
      const defaultDest = getDefaultExtractDestination();
      if (defaultDest) setDestination(defaultDest);
    }
  }, [isOpen, currentArchive, getDefaultExtractDestination]);

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Destination Folder",
      });

      if (selected) {
        setDestination(selected);
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
    }
  };

  const handleExtract = async () => {
    if (!destination || !currentArchive) return;

    if (hasSelection && !encrypted) {
      // Batch extract selected entries
      const selected = getSelectedEntries();
      const entryPaths = selected.map((e) => e.path);
      try {
        await invoke("extract_entries", {
          path: currentArchive,
          entryPaths,
          destination,
          overwrite,
        });
      } catch (err) {
        console.error("Batch extract failed:", err);
      }
    } else if (encrypted && password) {
      // Use password extraction directly
      await extractArchiveWithPassword(password);
    } else {
      // Try without password (will trigger fallback if needed)
      await extractArchive(destination, overwrite);
    }
    onOpenChange(false);
    setDestination("");
    setPassword("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOutput className="h-5 w-5 text-primary/80" />
            {hasSelection
              ? `Extract Selected (${selectedCount} files)`
              : "Extract Archive"}
          </DialogTitle>
          <DialogDescription>
            {hasSelection
              ? `Extract ${selectedCount} selected files to a destination folder.`
              : "Choose a destination folder to extract the archive contents."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Destination */}
          <div className="grid gap-2">
            <Label htmlFor="destination">Destination Folder</Label>
            <div className="flex gap-2">
              <Input
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Select a folder..."
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={handleBrowse}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Password (only shown for encrypted archives) */}
          {encrypted && (
            <div className="grid gap-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
              />
            </div>
          )}

          {/* Overwrite option */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="overwrite"
              checked={overwrite}
              onCheckedChange={(checked) => setOverwrite(checked === true)}
            />
            <Label htmlFor="overwrite" className="text-sm font-normal">
              Overwrite existing files
            </Label>
          </div>
        </div>

        <DialogFooter>
          {isLoading ? (
            extractProgress ? (
              <OperationProgress
                currentFile={extractProgress.current_file}
                filesProcessed={extractProgress.files_processed}
                totalFiles={extractProgress.total_files}
                bytesProcessed={extractProgress.bytes_processed}
                totalBytes={extractProgress.total_bytes}
                onCancel={cancelOperation}
              />
            ) : (
              <Button
                variant="destructive"
                onClick={cancelOperation}
                className="active:scale-[0.98]"
              >
                Cancel
              </Button>
            )
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="active:scale-[0.98]">
                Cancel
              </Button>
              <Button
                onClick={handleExtract}
                disabled={!destination || (encrypted && !password)}
                className="active:scale-[0.98]"
              >
                {hasSelection
                  ? `Extract ${selectedCount} files`
                  : "Extract"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
