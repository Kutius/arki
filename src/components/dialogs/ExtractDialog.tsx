import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import { useArchiveStore } from "../../store/archiveStore";
import { Button } from "../ui/button";
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

interface ExtractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtractDialog({ open: isOpen, onOpenChange }: ExtractDialogProps) {
  const [destination, setDestination] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const { extractArchive, isLoading, currentArchive } = useArchiveStore();

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

    try {
      await extractArchive(destination, overwrite);
      onOpenChange(false);
      setDestination("");
    } catch (err) {
      console.error("Extraction failed:", err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Extract Archive</DialogTitle>
          <DialogDescription>
            Choose a destination folder to extract the archive contents.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="overwrite"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="overwrite" className="text-sm font-normal">
              Overwrite existing files
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExtract}
            disabled={!destination || isLoading}
          >
            {isLoading ? "Extracting..." : "Extract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
