import { StopCircle } from "lucide-react";
import { Button } from "./button";
import { Progress } from "./progress";
import { formatFileSize } from "../../lib/format";

interface OperationProgressProps {
  /** Current file being processed */
  currentFile: string;
  /** Files processed so far */
  filesProcessed: number;
  /** Total files (0 if unknown, e.g. TAR streaming) */
  totalFiles: number;
  /** Bytes processed so far */
  bytesProcessed: number;
  /** Total bytes (0 if unknown) */
  totalBytes: number;
  /** Cancel callback */
  onCancel: () => void;
  /** Label for the cancel button */
  cancelLabel?: string;
}

/**
 * Reusable progress display for archive operations (extract/create).
 * Shows current file, progress bar, and cancel button.
 */
export function OperationProgress({
  currentFile,
  filesProcessed,
  totalFiles,
  bytesProcessed,
  totalBytes,
  onCancel,
  cancelLabel = "Cancel",
}: OperationProgressProps) {
  // Prefer byte-based progress for smoother updates
  const percent =
    totalBytes > 0
      ? Math.round((bytesProcessed / totalBytes) * 100)
      : totalFiles > 0
        ? Math.round((filesProcessed / totalFiles) * 100)
        : 0;

  const progressText =
    totalBytes > 0
      ? `${formatFileSize(bytesProcessed)} / ${formatFileSize(totalBytes)}`
      : totalFiles > 0
        ? `${filesProcessed}/${totalFiles} files`
        : `${filesProcessed} files`;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="truncate text-muted-foreground max-w-[280px]">
            {currentFile}
          </span>
          <span className="ml-2 text-muted-foreground tabular-nums shrink-0">
            {progressText}
          </span>
        </div>
        <Progress value={percent} className="h-1.5" />
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={onCancel}
        className="active:scale-[0.98]"
      >
        <StopCircle className="mr-1.5 h-3.5 w-3.5" />
        {cancelLabel}
      </Button>
    </div>
  );
}
