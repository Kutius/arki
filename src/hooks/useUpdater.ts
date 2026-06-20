import { useEffect } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";

/**
 * Auto-checks for updates on mount and shows a toast if one is available.
 * Side-effect only hook — no return values needed.
 */
export function useUpdater() {
  useEffect(() => {
    let cancelled = false;

    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update && !cancelled) {
          toast.info(`Update available: v${update.version}`, {
            action: {
              label: "Update",
              onClick: () => downloadAndInstall(update),
            },
            duration: 10000,
          });
        }
      } catch (err) {
        console.error("Failed to check for updates:", err);
      }
    };

    checkForUpdates();

    return () => {
      cancelled = true;
    };
  }, []);
}

async function downloadAndInstall(update: Update) {
  try {
    await update.downloadAndInstall();

    toast.success("Update downloaded. Restart to apply.", {
      duration: 5000,
    });
  } catch (err) {
    console.error("Failed to download update:", err);
    toast.error("Failed to download update");
  }
}
