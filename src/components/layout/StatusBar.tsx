import { Lock, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Progress } from "../ui/progress";
import { useArchiveStore } from "../../store/archiveStore";
import { formatFileSize } from "../../lib/format";

interface StatusBarProps {
  className?: string;
  status?: string;
  itemCount?: number;
  totalSize?: string;
  encrypted?: boolean;
  selectedCount?: number;
}

export function StatusBar({
  className,
  status = "Ready",
  itemCount,
  totalSize,
  encrypted,
  selectedCount,
}: StatusBarProps) {
  const extractProgress = useArchiveStore((s) => s.extractProgress);

  // Calculate progress percentage (prefer byte-based for smoother updates)
  const progressPercent =
    extractProgress && extractProgress.total_bytes > 0
      ? Math.round((extractProgress.bytes_processed / extractProgress.total_bytes) * 100)
      : extractProgress && extractProgress.total_files > 0
        ? Math.round((extractProgress.files_processed / extractProgress.total_files) * 100)
        : null;

  // Override status when extracting
  const displayStatus = extractProgress
    ? `Extracting: ${extractProgress.current_file}`
    : status;

  return (
    <div
      className={cn(
        "flex h-6 items-center justify-between border-t bg-background px-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {/* Status Text */}
        <span className="min-w-0 truncate text-[10px] text-muted-foreground/50">
          {displayStatus}
        </span>

        {/* Encrypted Indicator */}
        {encrypted && !extractProgress && (
          <div className="flex shrink-0 items-center gap-1">
            <Lock className="h-2.5 w-2.5 text-muted-foreground/40" />
            <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Encrypted</span>
          </div>
        )}

        {/* Progress Bar */}
        {progressPercent !== null && (
          <div className="flex shrink-0 items-center gap-2">
            <Progress value={progressPercent} className="w-24 h-1" />
            <span className="text-[9px] text-muted-foreground/50 tabular-nums">
              {extractProgress!.total_bytes > 0
                ? formatFileSize(extractProgress!.bytes_processed)
                : `${extractProgress!.files_processed}/${extractProgress!.total_files}`}
            </span>
            <button
              onClick={() => useArchiveStore.getState().cancelOperation()}
              className="flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
              title="Cancel operation"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Selection Count */}
        {selectedCount !== undefined && selectedCount > 0 && (
          <span className="text-[10px] text-primary tabular-nums">
            {selectedCount} selected
          </span>
        )}

        {/* Item Count */}
        {itemCount !== undefined && (
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">
            {itemCount} items
          </span>
        )}

        {/* Total Size */}
        {totalSize && (
          <span className="text-[10px] text-muted-foreground/40">{totalSize}</span>
        )}
      </div>
    </div>
  );
}
