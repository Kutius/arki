import { cn } from "../../lib/utils";
import { Progress } from "../ui/progress";

interface StatusBarProps {
  className?: string;
  status?: string;
  progress?: number;
  itemCount?: number;
  totalSize?: string;
}

export function StatusBar({
  className,
  status = "Ready",
  progress,
  itemCount,
  totalSize,
}: StatusBarProps) {
  return (
    <div
      className={cn(
        "flex h-7 items-center justify-between border-t bg-muted/50 px-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status Text */}
        <span className="text-[11px] text-muted-foreground">{status}</span>

        {/* Progress Bar (conditional) */}
        {progress !== undefined && (
          <div className="flex items-center gap-2">
            <Progress value={progress} className="w-32 h-1.5" />
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Item Count */}
        {itemCount !== undefined && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {itemCount} items
          </span>
        )}

        {/* Total Size */}
        {totalSize && (
          <span className="text-[11px] text-muted-foreground">{totalSize}</span>
        )}
      </div>
    </div>
  );
}
