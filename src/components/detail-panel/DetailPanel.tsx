import {
  Archive,
  Calendar,
  File,
  FileText,
  Folder,
  HardDrive,
  Info,
} from "lucide-react";
import type { ArchiveEntry } from "../file-list/FileListView";
import { cn } from "../../lib/utils";
import { Separator } from "../ui/separator";

interface DetailPanelProps {
  className?: string;
  entry: ArchiveEntry | null;
  totalEntries?: number;
  totalSize?: number;
  compressedSize?: number;
}

export function DetailPanel({
  className,
  entry,
  totalEntries,
  totalSize,
  compressedSize,
}: DetailPanelProps) {
  if (!entry) {
    return (
      <div
        className={cn(
          "flex h-full w-64 flex-col border-l bg-background",
          className,
        )}
      >
        <div className="flex h-12 items-center border-b px-4">
          <span className="text-sm font-medium text-foreground">Details</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-muted-foreground">
          <Info className="mb-2 h-8 w-8" />
          <p className="text-center text-sm">
            Select a file to view details
          </p>
        </div>
      </div>
    );
  }

  const compressionRatio =
    entry.compressedSize && entry.size > 0
      ? ((1 - entry.compressedSize / entry.size) * 100).toFixed(1)
      : null;

  return (
    <div
      className={cn(
        "flex h-full w-64 flex-col border-l bg-background",
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center border-b px-4">
        <span className="text-sm font-medium text-foreground">Details</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* File Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
            {entry.isDirectory ? (
              <Folder className="h-8 w-8 text-muted-foreground" />
            ) : (
              <File className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* File Name */}
        <div className="mb-4 text-center">
          <p className="text-sm font-medium break-all">{entry.name}</p>
          <p className="text-xs text-muted-foreground">
            {entry.isDirectory ? "Folder" : getFileType(entry.name)}
          </p>
        </div>

        <Separator className="mb-4" />

        {/* Properties */}
        <div className="space-y-3">
          <PropertyRow
            icon={HardDrive}
            label="Size"
            value={formatFileSize(entry.size)}
          />

          {entry.compressedSize && (
            <PropertyRow
              icon={Archive}
              label="Compressed"
              value={formatFileSize(entry.compressedSize)}
            />
          )}

          {compressionRatio && (
            <PropertyRow
              icon={Info}
              label="Ratio"
              value={`${compressionRatio}% smaller`}
            />
          )}

          {entry.modified && (
            <PropertyRow
              icon={Calendar}
              label="Modified"
              value={entry.modified}
            />
          )}

          <PropertyRow
            icon={FileText}
            label="Path"
            value={entry.path}
            truncate
          />
        </div>

        {/* Archive Stats (if available) */}
        {totalEntries !== undefined && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Archive Info
              </p>
              <PropertyRow
                icon={File}
                label="Total Files"
                value={totalEntries.toString()}
              />
              {totalSize && (
                <PropertyRow
                  icon={HardDrive}
                  label="Total Size"
                  value={formatFileSize(totalSize)}
                />
              )}
              {compressedSize && (
                <PropertyRow
                  icon={Archive}
                  label="Archive Size"
                  value={formatFileSize(compressedSize)}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PropertyRow({
  icon: Icon,
  label,
  value,
  truncate,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-sm",
            truncate && "truncate text-xs",
          )}
        >
          {value}
        </p>
      </div>
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
