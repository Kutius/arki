import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Home,
  Regex,
  Search,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { formatFileSize, getPreviewType } from "../../lib/format";
import { FileIcon } from "../../lib/fileIcons";
import { useStaggerReveal } from "../../lib/animations";
import { ScrollArea } from "../ui/scroll-area";
import type { ArchiveEntry } from "../../store/archiveStore";
import { useArchiveStore } from "../../store/archiveStore";

interface FileListViewProps {
  entries: ArchiveEntry[];
  onEntrySelect?: (entry: ArchiveEntry) => void;
  onEntryDoubleClick?: (entry: ArchiveEntry) => void;
  onEntryMultiSelect?: (entry: ArchiveEntry, additive: boolean) => void;
  onEntryDelete?: () => void;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  selectedEntries?: Set<string>;
  searchVisible?: boolean;
  onSearchClose?: () => void;
  /** When set, the DetailPanel is showing this entry — suppress hover preview. */
  pinnedEntry?: ArchiveEntry | null;
}

type SortField = "name" | "size" | "modified";
type SortDirection = "asc" | "desc";
type FileTypeFilter = "all" | "images" | "documents" | "archives" | "other";

export function FileListView({
  entries,
  onEntrySelect,
  onEntryDoubleClick,
  onEntryMultiSelect,
  onEntryDelete,
  currentPath = "/",
  onNavigate,
  selectedEntries,
  searchVisible = false,
  onSearchClose,
  pinnedEntry,
}: FileListViewProps) {
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntry | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>("all");
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  // Hover preview state
  const [hoveredEntry, setHoveredEntry] = useState<ArchiveEntry | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewRowRect, setPreviewRowRect] = useState<DOMRect | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const hoveredEntryRef = useRef<ArchiveEntry | null>(null);

  // Staggered row reveal on archive open / directory navigate
  useStaggerReveal(scrollContentRef, {
    itemSelector: "[data-stagger]",
    deps: [entries, currentPath],
    maxItems: 30,
    offsetY: 4,
  });

  // Hover preview: delayed show after 300ms
  useEffect(() => {
    // Don't show if a file is pinned in DetailPanel
    if (pinnedEntry) {
      setShowPreview(false);
      return;
    }
    if (!hoveredEntry || hoveredEntry.isDirectory) {
      setShowPreview(false);
      return;
    }

    // Skip if no previewable content
    if (!getPreviewType(hoveredEntry.name)) {
      setShowPreview(false);
      return;
    }

    hoverTimerRef.current = requestAnimationFrame(() => {
      hoverTimerRef.current = setTimeout(() => {
        // Verify the entry is still hovered (ref check avoids stale closure)
        if (hoveredEntryRef.current === hoveredEntry) {
          setShowPreview(true);
        }
      }, 300) as unknown as ReturnType<typeof requestAnimationFrame>;
    });

    return () => {
      if (hoverTimerRef.current !== null) {
        clearTimeout(hoverTimerRef.current as unknown as number);
        cancelAnimationFrame(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [hoveredEntry, pinnedEntry]);

  const handleRowMouseEnter = useCallback((entry: ArchiveEntry, e: React.MouseEvent) => {
    hoveredEntryRef.current = entry;
    setHoveredEntry(entry);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPreviewRowRect(rect);
  }, []);

  const handleRowMouseLeave = useCallback(() => {
    hoveredEntryRef.current = null;
    setHoveredEntry(null);
    setShowPreview(false);
  }, []);

  const handleEntryClick = (entry: ArchiveEntry, e: React.MouseEvent, index: number) => {
    setFocusedIndex(index);
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: toggle selection
      onEntryMultiSelect?.(entry, true);
    } else if (e.shiftKey) {
      // Shift+Click: range select
      onEntryMultiSelect?.(entry, false);
    } else {
      // Skip if already selected — prevents DetailPanel flicker from re-mounting
      if (selectedEntry?.path === entry.path) return;
      setSelectedEntry(entry);
      onEntrySelect?.(entry);
    }
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

  // Filter entries to current directory level and synthesize virtual directories
  const visibleEntries = useMemo(() => {
    const normalizedCurrentPath = currentPath === "/" ? "" : currentPath.replace(/^\/|\/$/g, "");
    const currentPrefix = normalizedCurrentPath ? normalizedCurrentPath + "/" : "";

    // Two-pass approach: first collect virtual directories from nested paths,
    // then add direct entries while deduplicating against directory names.

    // Pass 1: Collect virtual directory names from nested entries
    const dirNames = new Set<string>();
    const directEntries: { entry: ArchiveEntry; normalizedPath: string }[] = [];

    for (const entry of entries) {
      const entryPath = entry.path.replace(/\\/g, "/").replace(/^\/|\/$/g, "");
      if (normalizedCurrentPath && !entryPath.startsWith(currentPrefix)) continue;

      const relativePath = normalizedCurrentPath ? entryPath.slice(currentPrefix.length) : entryPath;
      if (!relativePath) continue;

      if (relativePath.includes("/")) {
        // Nested entry — the first path component is a directory
        dirNames.add(relativePath.split("/")[0]);
      } else {
        directEntries.push({ entry, normalizedPath: entryPath });
      }
    }

    // Pass 2: Build result — directories first, then files that don't conflict
    const result: ArchiveEntry[] = [];

    // Add virtual directories
    for (const dirName of dirNames) {
      result.push({
        name: dirName,
        path: currentPrefix + dirName,
        isDirectory: true,
        size: 0,
      });
    }

    // Add direct entries, skipping any that shadow a directory
    const dirNameSet = new Set(dirNames);
    for (const { entry, normalizedPath } of directEntries) {
      if (!dirNameSet.has(normalizedPath)) {
        result.push(entry);
      }
    }

    return result;
  }, [entries, currentPath]);

  // Sort entries
  const sortedEntries = useMemo(() => {
    return [...visibleEntries].sort((a, b) => {
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
  }, [visibleEntries, sortField, sortDirection]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return sortedEntries.filter((entry) => {
      // Type filter
      if (typeFilter !== "all") {
        if (!entry.isDirectory && !matchesTypeFilter(entry.name, typeFilter)) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        if (useRegex) {
          try {
            const regex = new RegExp(searchQuery, "i");
            return regex.test(entry.name);
          } catch {
            // Invalid regex, show all
            return true;
          }
        } else {
          return entry.name.toLowerCase().includes(searchQuery.toLowerCase());
        }
      }

      return true;
    });
  }, [sortedEntries, searchQuery, useRegex, typeFilter]);

  // Focus search when it becomes visible
  useEffect(() => {
    if (searchVisible) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [searchVisible]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't handle if user is typing in search
      if (document.activeElement === searchRef.current) return;
      if (filteredEntries.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          const nextIndex = Math.min(focusedIndex + 1, filteredEntries.length - 1);
          setFocusedIndex(nextIndex);
          const entry = filteredEntries[nextIndex];
          if (entry) {
            setSelectedEntry(entry);
            onEntrySelect?.(entry);
          }
          break;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          const prevIndex = Math.max(focusedIndex - 1, 0);
          setFocusedIndex(prevIndex);
          const entry = filteredEntries[prevIndex];
          if (entry) {
            setSelectedEntry(entry);
            onEntrySelect?.(entry);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          const current = filteredEntries[focusedIndex];
          if (current) {
            handleEntryDoubleClick(current);
          }
          break;
        }
        case "Delete": {
          e.preventDefault();
          onEntryDelete?.();
          break;
        }
        case "Backspace": {
          e.preventDefault();
          const parentParts = currentPath.split("/").filter(Boolean);
          if (parentParts.length > 0) {
            const parent = parentParts.length > 1
              ? "/" + parentParts.slice(0, -1).join("/")
              : "/";
            onNavigate?.(parent);
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          setFocusedIndex(0);
          const first = filteredEntries[0];
          if (first) {
            setSelectedEntry(first);
            onEntrySelect?.(first);
          }
          break;
        }
        case "End": {
          e.preventDefault();
          const lastIndex = filteredEntries.length - 1;
          setFocusedIndex(lastIndex);
          const last = filteredEntries[lastIndex];
          if (last) {
            setSelectedEntry(last);
            onEntrySelect?.(last);
          }
          break;
        }
      }
    },
    [focusedIndex, filteredEntries, onEntrySelect, onEntryDelete, handleEntryDoubleClick],
  );

  // Breadcrumb path parts
  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex h-9 items-center gap-1 overflow-hidden border-b px-3">
        <button
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors",
            pathParts.length > 0
              ? "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
              : "text-muted-foreground/20 cursor-not-allowed",
          )}
          onClick={() => {
            if (pathParts.length > 0) {
              const parent = pathParts.length > 1
                ? "/" + pathParts.slice(0, -1).join("/")
                : "/";
              onNavigate?.(parent);
            }
          }}
          disabled={pathParts.length === 0}
          title="Go back"
        >
          <ArrowLeft className="size-3" />
        </button>
        <button
          className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
          onClick={() => onNavigate?.("/")}
        >
          <Home className="size-3" />
          Root
        </button>
        {pathParts.map((part, index) => (
          <div key={index} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/30" />
            <button
              className="truncate text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
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
      <div className="flex h-8 items-center border-b bg-muted/20 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
        <div
          className="flex flex-1 cursor-pointer items-center gap-1 hover:text-muted-foreground/70 transition-colors"
          onClick={() => handleSort("name")}
        >
          Name
          {sortField === "name" && (
            <SortIndicator direction={sortDirection} />
          )}
        </div>
        <div
          className="flex w-20 cursor-pointer items-center justify-end gap-1 hover:text-muted-foreground/70 transition-colors"
          onClick={() => handleSort("size")}
        >
          Size
          {sortField === "size" && (
            <SortIndicator direction={sortDirection} />
          )}
        </div>
        <div
          className="flex w-28 cursor-pointer items-center gap-1 pl-3 hover:text-muted-foreground/70 transition-colors"
          onClick={() => handleSort("modified")}
        >
          Modified
          {sortField === "modified" && (
            <SortIndicator direction={sortDirection} />
          )}
        </div>
      </div>

      {/* Search Bar -- toggled from toolbar */}
      {searchVisible && (
        <div className="flex h-9 items-center gap-1.5 border-b px-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Filter files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchQuery("");
                  onSearchClose?.();
                }
              }}
              className="h-7 w-full rounded-md border-0 bg-muted/30 pl-7 pr-14 text-xs outline-none focus:bg-muted/50 focus:ring-1 focus:ring-ring/30 transition-all placeholder:text-muted-foreground/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={cn(
              "flex h-7 items-center justify-center rounded-md px-1.5 text-xs transition-colors",
              useRegex
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground/40 hover:bg-muted/30 hover:text-muted-foreground",
            )}
            title="Toggle regex search"
          >
            <Regex className="size-3" />
          </button>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as FileTypeFilter)}
              className="h-7 rounded-md border-0 bg-muted/30 pl-1.5 pr-6 text-xs text-muted-foreground/70 outline-none focus:ring-1 focus:ring-ring/30 transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All</option>
              <option value="images">Images</option>
              <option value="documents">Docs</option>
              <option value="archives">Archives</option>
              <option value="other">Other</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40" />
          </div>
        </div>
      )}

      {/* File List */}
      <ScrollArea className="flex-1 min-h-0">
        <div
          key={searchQuery || "__all__"}
          ref={(node) => {
            // Assign to both refs
            (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            (scrollContentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className={cn("outline-none", searchQuery && "search-results-animate")}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {filteredEntries.map((entry, index) => {
            const isMultiSelected = selectedEntries?.has(entry.path);
            const isFocused = index === focusedIndex;
            return (
            <div
              key={entry.path}
              data-stagger
              data-row-path={entry.path}
              className={cn(
                "flex h-[34px] cursor-pointer items-center px-3 transition-colors relative",
                "hover:bg-accent/50",
                (isMultiSelected || selectedEntry?.path === entry.path) && "bg-accent",
                isFocused && "ring-1 ring-inset ring-ring/50",
              )}
              onClick={(e) => handleEntryClick(entry, e, index)}
              onDoubleClick={() => handleEntryDoubleClick(entry)}
              onMouseEnter={(e) => handleRowMouseEnter(entry, e)}
              onMouseLeave={handleRowMouseLeave}
            >
              {/* Selection accent bar */}
              {(isMultiSelected || selectedEntry?.path === entry.path) && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary/60 accent-bar-animate" />
              )}
              {/* Icon */}
              <div className="mr-2.5">
                <EntryIcon entry={entry} />
              </div>

              {/* Name */}
              <div className="flex-1 truncate text-[13px]">{entry.name}</div>

              {/* Size */}
              <div className="w-20 text-right text-[12px] text-muted-foreground/50 tabular-nums">
                {!entry.isDirectory && formatFileSize(entry.size)}
              </div>

              {/* Modified */}
              <div className="w-28 truncate pl-3 text-[12px] text-muted-foreground/50">
                {entry.modified || "—"}
              </div>
            </div>
            );
          })}

          {filteredEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderOpen className="size-8 mb-2" />
              <p className="text-sm">
                {searchQuery ? "No matching files" : "No files found"}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Hover Preview — rendered as portal to escape overflow clipping */}
      {showPreview && hoveredEntry && previewRowRect && !pinnedEntry && (
        <HoverPreview
          entry={hoveredEntry}
          rowRect={previewRowRect}
        />
      )}
    </div>
  );
}

function EntryIcon({ entry }: { entry: ArchiveEntry }) {
  if (entry.isDirectory) {
    return <Folder className="size-4 text-blue-400/70" />;
  }
  return <FileIcon name={entry.name} />;
}

function SortIndicator({ direction }: { direction: SortDirection }) {
  return (
    <span className="inline-flex transition-transform duration-200" style={{ transform: direction === "desc" ? "rotate(180deg)" : "rotate(0deg)" }}>
      <ArrowUp className="size-3" />
    </span>
  );
}

function matchesTypeFilter(
  filename: string,
  filter: Exclude<FileTypeFilter, "all">,
): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  switch (filter) {
    case "images":
      return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"].includes(ext);
    case "documents":
      return [
        "txt", "md", "json", "xml", "yaml", "yml", "csv", "pdf",
        "doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf", "odt",
      ].includes(ext);
    case "archives":
      return ["zip", "7z", "rar", "tar", "gz", "bz2", "br", "zst", "tgz"].includes(ext);
    case "other":
      return !["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff",
        "txt", "md", "json", "xml", "yaml", "yml", "csv", "pdf",
        "doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf", "odt",
        "zip", "7z", "rar", "tar", "gz", "bz2", "br", "zst", "tgz",
      ].includes(ext);
    default:
      return true;
  }
}

// ─── Hover Preview ─────────────────────────────────────────────────

function HoverPreview({
  entry,
  rowRect,
}: {
  entry: ArchiveEntry;
  rowRect: DOMRect;
}) {
  const previewType = getPreviewType(entry.name);
  const currentArchive = useArchiveStore((s) => s.currentArchive);
  const [content, setContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentArchive || !previewType) return;
    let cancelled = false;

    invoke<string>("preview_file", {
      path: currentArchive,
      entryPath: entry.path,
    })
      .then((base64) => {
        if (cancelled) return;
        if (previewType === "image") {
          const ext = entry.name.split(".").pop()?.toLowerCase();
          const mimeMap: Record<string, string> = {
            jpg: "image/jpeg", jpeg: "image/jpeg",
            png: "image/png", gif: "image/gif",
            webp: "image/webp", svg: "image/svg+xml",
            bmp: "image/bmp", ico: "image/x-icon",
          };
          setImageUrl(`data:${mimeMap[ext || ""] || "application/octet-stream"};base64,${base64}`);
        } else {
          const text = atob(base64);
          const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0));
          setContent(new TextDecoder("utf-8").decode(bytes));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentArchive, entry.path, entry.name, previewType]);

  // Position: to the right of the row, vertically aligned
  const CARD_W = 280;
  const CARD_MAX_H = 200;
  const GAP = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rowRect.right + GAP;
  // Flip to left side if overflowing right edge
  if (left + CARD_W > vw - 12) {
    left = rowRect.left - CARD_W - GAP;
  }
  // Clamp to viewport
  left = Math.max(8, Math.min(left, vw - CARD_W - 8));

  let top = rowRect.top;
  if (top + CARD_MAX_H > vh - 12) {
    top = vh - CARD_MAX_H - 12;
  }
  top = Math.max(8, top);

  return createPortal(
    <div
      className="fixed z-[100] w-[280px] max-h-[200px] rounded-lg border bg-popover shadow-lg overflow-hidden pointer-events-none preview-card-animate"
      style={{ left, top }}
    >
      {loading ? (
        <div className="flex items-center justify-center h-16">
          <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
        </div>
      ) : previewType === "image" && imageUrl ? (
        <div className="flex items-center justify-center p-2 bg-muted/20">
          <img
            src={imageUrl}
            alt={entry.name}
            className="max-h-[192px] max-w-full rounded object-contain"
          />
        </div>
      ) : content !== null ? (
        <div className="p-2.5 overflow-hidden">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileIcon name={entry.name} className="h-3 w-3" />
            <span className="text-[10px] text-muted-foreground/50 truncate">{entry.name}</span>
            <span className="ml-auto text-[9px] text-muted-foreground/30 tabular-nums">{formatFileSize(entry.size)}</span>
          </div>
          <pre className="text-[10px] leading-[1.5] text-foreground/50 font-mono whitespace-pre-wrap break-all max-h-[156px] overflow-hidden">
            {previewType === "json"
              ? formatJson(content)
              : previewType === "xml"
                ? formatXml(content)
                : content.length > 2000
                  ? content.slice(0, 2000) + "\n..."
                  : content}
          </pre>
        </div>
      ) : (
        <div className="flex items-center justify-center h-16 text-[11px] text-muted-foreground/30">
          No preview
        </div>
      )}
    </div>,
    document.body,
  );
}

function formatJson(content: string): string {
  try { return JSON.stringify(JSON.parse(content), null, 2).slice(0, 2000); }
  catch { return content.slice(0, 2000); }
}

function formatXml(content: string): string {
  try {
    let formatted = "";
    let indent = 0;
    const lines = content.replace(/>\s*</g, ">\n<").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("</")) indent = Math.max(0, indent - 1);
      formatted += "  ".repeat(indent) + trimmed + "\n";
      if (trimmed.startsWith("<") && !trimmed.startsWith("</") && !trimmed.startsWith("<?") && !trimmed.endsWith("/>") && !/<\/[^>]+>$/.test(trimmed)) indent++;
    }
    return formatted.trim().slice(0, 2000);
  }
  catch { return content.slice(0, 2000); }
}
