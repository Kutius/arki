import { useRef } from "react";
import {
  Archive,
  ClipboardCopy,
  Eye,
  ExternalLink,
  FolderOutput,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { formatFileSize, getPreviewType } from "../../lib/format";
import type { PreviewType } from "../../lib/format";
import type { ArchiveEntry } from "../../store/archiveStore";
import { useSlideIn } from "../../lib/animations";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useArchiveStore } from "../../store/archiveStore";

interface DetailPanelProps {
  className?: string;
  entry: ArchiveEntry | null;
  totalEntries?: number;
  totalSize?: number;
  compressedSize?: number;
  format?: string;
  onOpenEntry?: (entry: ArchiveEntry) => void;
  onExtractEntry?: (entry: ArchiveEntry) => void;
  onClose?: () => void;
}

export function DetailPanel({
  className,
  entry,
  totalEntries,
  totalSize,
  compressedSize,
  format,
  onOpenEntry,
  onExtractEntry,
  onClose,
}: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    previewContent,
    previewImageUrl,
    previewType,
    isLoadingPreview,
  } = useArchiveStore();

  // Slide in from right when entry changes
  useSlideIn(panelRef, {
    direction: "right",
    distance: 12,
    deps: [entry?.path],
  });

  if (!entry) return null;

  const compressionRatio =
    entry.compressedSize && entry.size > 0
      ? ((1 - entry.compressedSize / entry.size) * 100).toFixed(1)
      : null;

  return (
    <div
      ref={panelRef}
      className={cn(
        "flex h-full w-72 flex-col border-l bg-background",
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-9 items-center justify-between border-b px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">Details</span>
        <div className="flex items-center gap-2">
          {format && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0">{format}</Badge>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* File Name */}
          <div className="mb-3 overflow-hidden">
            <p className="text-[14px] font-medium truncate leading-snug" title={entry.name}>{entry.name}</p>
            <p className="text-[11px] text-muted-foreground/40 mt-0.5">
              {entry.isDirectory ? "Folder" : getFileType(entry.name)}
            </p>
          </div>

          {/* Quick Actions */}
          {!entry.isDirectory && (
            <div className="mb-3 flex items-center gap-0.5">
              {onOpenEntry && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        onClick={() => onOpenEntry(entry)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-accent hover:text-accent-foreground active:scale-[0.97] transition-all"
                      />
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Open with default app</TooltipContent>
                </Tooltip>
              )}
              {onExtractEntry && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        onClick={() => onExtractEntry(entry)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-accent hover:text-accent-foreground active:scale-[0.97] transition-all"
                      />
                    }
                  >
                    <FolderOutput className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Extract this file</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(entry.path);
                        toast.success("Path copied to clipboard");
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-accent hover:text-accent-foreground active:scale-[0.97] transition-all"
                    />
                  }
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Copy path</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Preview Section */}
          {!entry.isDirectory && (
            <PreviewSection
              entry={entry}
              previewContent={previewContent}
              previewImageUrl={previewImageUrl}
              previewType={previewType}
              isLoading={isLoadingPreview}
            />
          )}

          <div className="my-3 h-px bg-border" />

          {/* Properties */}
          <div className="flex flex-col gap-2.5">
            <PropertyRow
              label="Size"
              value={formatFileSize(entry.size)}
            />

            {entry.compressedSize && (
              <PropertyRow
                label="Compressed"
                value={formatFileSize(entry.compressedSize)}
              />
            )}

            {compressionRatio && (
              <PropertyRow
                label="Ratio"
                value={`${compressionRatio}% smaller`}
              />
            )}

            {entry.modified && (
              <PropertyRow
                label="Modified"
                value={entry.modified}
              />
            )}

            <PropertyRow
              label="Path"
              value={entry.path}
              truncate
            />
          </div>

          {/* Archive Stats (if available) */}
          {totalEntries !== undefined && (
            <>
              <div className="my-3 h-px bg-border" />
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-1">
                  <Archive className="h-3 w-3 text-muted-foreground/40" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                    Archive
                  </p>
                </div>
                <PropertyRow
                  label="Files"
                  value={totalEntries.toString()}
                />
                {totalSize && (
                  <PropertyRow
                    label="Total Size"
                    value={formatFileSize(totalSize)}
                  />
                )}
                {compressedSize && (
                  <PropertyRow
                    label="Archive Size"
                    value={formatFileSize(compressedSize)}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function PreviewSection({
  entry,
  previewContent,
  previewImageUrl,
  previewType,
  isLoading,
}: {
  entry: ArchiveEntry;
  previewContent: string | null;
  previewImageUrl: string | null;
  previewType: PreviewType;
  isLoading: boolean;
}) {
  const filePreviewType = getPreviewType(entry.name);

  if (!filePreviewType) return null;

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center gap-1">
        <Eye className="h-3 w-3 text-muted-foreground/40" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
          Preview
        </span>
      </div>

      <div className="overflow-hidden rounded-md bg-muted/20 border border-border/50">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ) : previewType === "image" && previewImageUrl ? (
          <div className="flex items-center justify-center p-2 overflow-hidden">
            <img
              src={previewImageUrl}
              alt={entry.name}
              className="max-h-40 max-w-full rounded object-contain"
            />
          </div>
        ) : previewType === "json" && previewContent ? (
          <pre className="max-h-40 overflow-y-auto overflow-x-hidden p-2.5 text-[11px] leading-relaxed text-foreground/50 font-mono whitespace-pre-wrap break-all">
            {formatJson(previewContent)}
          </pre>
        ) : previewType === "xml" && previewContent ? (
          <pre className="max-h-40 overflow-y-auto overflow-x-hidden p-2.5 text-[11px] leading-relaxed text-foreground/50 font-mono whitespace-pre-wrap break-all">
            {formatXml(previewContent)}
          </pre>
        ) : previewType === "text" && previewContent ? (
          <pre className="max-h-40 overflow-y-auto overflow-x-hidden p-2.5 text-[11px] leading-relaxed text-foreground/50 font-mono whitespace-pre-wrap break-all">
            {previewContent.length > 5000
              ? previewContent.slice(0, 5000) + "\n..."
              : previewContent}
          </pre>
        ) : (
          <div className="flex h-16 items-center justify-center text-[11px] text-muted-foreground/25">
            No preview
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyRow({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 overflow-hidden">
      <p className="text-[11px] text-muted-foreground/40 shrink-0">{label}</p>
      <p
        className={cn(
          "text-[12px] text-foreground/70 text-right min-w-0",
          truncate && "truncate text-[11px]",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    zip: "ZIP Archive",
    "7z": "7-Zip Archive",
    rar: "RAR Archive",
    tar: "TAR Archive",
    gz: "Gzip Archive",
    bz2: "Bzip2 Archive",
    txt: "Text File",
    md: "Markdown File",
    json: "JSON File",
    xml: "XML File",
    jpg: "JPEG Image",
    jpeg: "JPEG Image",
    png: "PNG Image",
    gif: "GIF Image",
    pdf: "PDF Document",
    doc: "Word Document",
    docx: "Word Document",
    xls: "Excel Spreadsheet",
    xlsx: "Excel Spreadsheet",
    ppt: "PowerPoint",
    pptx: "PowerPoint",
  };
  return types[ext || ""] || "File";
}

function formatJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function formatXml(content: string): string {
  // Simple XML formatter: add newlines after closing tags
  try {
    let formatted = "";
    let indent = 0;
    const lines = content
      .replace(/>\s*</g, ">\n<")
      .split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("</")) {
        indent = Math.max(0, indent - 1);
      }

      formatted += "  ".repeat(indent) + trimmed + "\n";

      if (
        trimmed.startsWith("<") &&
        !trimmed.startsWith("</") &&
        !trimmed.startsWith("<?") &&
        !trimmed.endsWith("/>") &&
        !/<\/[^>]+>$/.test(trimmed)
      ) {
        indent++;
      }
    }

    return formatted.trim();
  } catch {
    return content;
  }
}
