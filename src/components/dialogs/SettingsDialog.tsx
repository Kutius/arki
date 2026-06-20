import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { Check, FolderOpen, Moon, Monitor, Settings, Sun, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
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
import { cn } from "../../lib/utils";
import { applyTheme } from "../../store/archiveStore";
import type { AppSettings } from "../../store/archiveStore";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const THEME_OPTIONS = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function SettingsDialog({ open: isOpen, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>({
    default_extract_path: null,
    default_compression_level: 6,
    theme: "dark",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      invoke<AppSettings>("get_settings").then((s) => setSettings(s));
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await invoke("save_settings", { settings });
      // Apply theme immediately — don't wait for store's async loadSettings
      applyTheme(settings.theme);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowseExtractPath = async () => {
    try {
      const selected = await open({
        directory: true,
        title: "Select Default Extract Path",
      });
      if (selected) {
        setSettings((prev) => ({
          ...prev,
          default_extract_path: Array.isArray(selected) ? selected[0] : selected,
        }));
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const update = await check();
      if (update) {
        toast.info(`Update available: v${update.version}`, {
          description: update.body || undefined,
          action: {
            label: "Download",
            onClick: async () => {
              await update.downloadAndInstall();
              toast.success("Update downloaded. Restart to apply.");
            },
          },
          duration: 10000,
        });
      } else {
        toast.success("You're up to date!");
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      toast.error("Failed to check for updates");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary/80" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your Arki preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme */}
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, theme: option.value }))
                  }
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-1 rounded-md border p-3 text-sm transition-all",
                    settings.theme === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted",
                  )}
                >
                  {settings.theme === option.value && (
                    <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                  <option.icon className="h-5 w-5" />
                  <span className="font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Default Extract Path */}
          <div className="space-y-2">
            <Label>Default Extract Path</Label>
            <div className="flex gap-2">
              <Input
                value={settings.default_extract_path || ""}
                placeholder="Not set (will prompt each time)"
                readOnly
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={handleBrowseExtractPath}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            {settings.default_extract_path && (
              <button
                onClick={() =>
                  setSettings((prev) => ({ ...prev, default_extract_path: null }))
                }
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>

          {/* Default Compression Level */}
          <div className="space-y-2">
            <Label>Default Compression Level</Label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={9}
                value={settings.default_compression_level}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    default_compression_level: Number(e.target.value),
                  }))
                }
                className="flex-1"
              />
              <span className="w-8 text-center text-sm font-medium tabular-nums">
                {settings.default_compression_level}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Fastest</span>
              <span>Balanced</span>
              <span>Best</span>
            </div>
          </div>

          {/* Check for Updates */}
          <div className="space-y-2">
            <Label>Updates</Label>
            <Button
              variant="outline"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isCheckingUpdate ? "animate-spin" : ""}`} />
              {isCheckingUpdate ? "Checking..." : "Check for Updates"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="active:scale-[0.98]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="active:scale-[0.98]">
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
