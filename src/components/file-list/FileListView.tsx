import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  File,
  FileArchive,
  FileText,
  Folder,
  FolderOpen,
  Image,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";

export interface ArchiveEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  compressedSize?: number;
  modified?: string;
  mimeType?: string;
}

interface FileListViewProps {
  entries: ArchiveEntry[];
  onEntrySelect?: (entry: ArchiveEntry) => void;
  onEntryDoubleClick?: (entry: ArchiveEntry) => void;
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

type SortField = "name" | "size" | "modified";
type SortDirection = "asc" | "desc";

export function FileListView({
  entries,
  onEntrySelect,
  onEntryDoubleClick,
  currentPath = "/",
  onNavigate,
}: FileListViewProps) {
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntry | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleEntryClick = (entry: ArchiveEntry) => {
    setSelectedEntry(entry);
    onEntrySelect?.(entry);
  };

  const handleEntryDoubleClick = (entry: ArchiveEntry) => {
    if (entry.isDirectory) {
      onNavigate?.(entry.path);
    } else {
      onEntryDoubleClick?.(entry);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort entries
  const sortedEntries = [...entries].sort((a, b) => {
    // Directories first
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    let comparison = 0;
    switch (sortField) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "size":
        comparison = a.size - b.size;
        break;
      case "modified":
        comparison = (a.modified || "").localeCompare(b.modified || "");
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Breadcrumb path parts
  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex h-10 items-center gap-1 border-b px-4">
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => onNavigate?.("/")}
        >
          Root
        </button>
        {pathParts.map((part, index) => (
          <div key={index} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() =>
                onNavigate?.("/" + pathParts.slice(0, index + 1).join("/"))
              }
            >
              {part}
            </button>
          </div>
        ))}
      </div>

      {/* Table Header */}
      <div className="flex h-9 items-center border-b bg-muted/50 px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <div
          className="flex flex-1 cursor-pointer items-center gap-1"
          onClick={() => handleSort("name")}
        >
          Name
          {sortField === "name" && (
            <SortIndicator direction={sortDirection} />
          )}
        </div>
        <div
          className="flex w-24 cursor-pointer items-center justify-end gap-1"
          onClick={() => handleSort("size")}
        >
          Size
          {sortField === "size" && (
            <SortIndicator direction={sortDirection} />
          )}
        </div>
        <div
          className="flex w-36 cursor-pointer items-center gap-1 pl-4"
          onClick={() => handleSort("modified")}
        >
          Modified
          {sortField === "modified" && (
            <SortIndicator direction={sortDirection} />
          )}
        </div>
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {sortedEntries.map((entry) => (
            <div
              key={entry.path}
              className={cn(
                "flex h-9 cursor-pointer items-center rounded-md px-3 text-sm transition-colors",
                "hover:bg-accent",
                selectedEntry?.path === entry.path && "bg-accent",
              )}
              onClick={() => handleEntryClick(entry)}
              onDoubleClick={() => handleEntryDoubleClick(entry)}
            >
              {/* Icon */}
              <div className="mr-2">
                <FileIcon entry={entry} />
              </div>

              {/* Name */}
              <div className="flex-1 truncate">{entry.name}</div>

              {/* Size */}
              <div className="w-24 text-right text-xs text-muted-foreground tabular-nums">
                {!entry.isDirectory && formatFileSize(entry.size)}
              </div>

              {/* Modified */}
              <div className="w-36 truncate pl-4 text-xs text-muted-foreground">
                {entry.modified || "—"}
              </div>
            </div>
          ))}

          {sortedEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderOpen className="mb-2 h-8 w-8" />
              <p className="text-sm">No files found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FileIcon({ entry }: { entry: ArchiveEntry }) {
  if (entry.isDirectory) {
    return <Folder className="h-4 w-4 text-muted-foreground" />;
  }

  const ext = entry.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "zip":
    case "7z":
    case "rar":
    case "tar":
    case "gz":
    case "bz2":
      return <FileArchive className="h-4 w-4 text-muted-foreground" />;
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
    case "svg":
      return <Image className="h-4 w-4 text-muted-foreground" />;
    case "txt":
    case "md":
    case "json":
    case "xml":
    case "yaml":
    case "yml":
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function SortIndicator({ direction }: { direction: SortDirection }) {
  return direction === "asc" ? (
    <ArrowUp className="h-3 w-3" />
  ) : (
    <ArrowDown className="h-3 w-3" />
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
