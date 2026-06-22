import {
  Clock,
  FileArchive,
  Star,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { getParentPath } from "../../lib/path";
import { getFormatBadgeClass } from "../../lib/format";
import { ScrollArea } from "../ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useArchiveStore } from "../../store/archiveStore";
import type { HistoryEntry } from "../../store/archiveStore";

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

export function HistoryPanel({ open, onClose }: HistoryPanelProps) {
  const { history, openArchive, removeFromHistory, toggleFavorite, currentArchive } =
    useArchiveStore();

  const favoriteItems = history.filter((h) => h.is_favorite);
  const recentItems = history.slice(0, 20);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm"
        style={{ animation: "overlay-in 200ms var(--ease-out)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed left-0 top-10 bottom-0 z-50 w-72 border-r bg-sidebar-background shadow-lg flex flex-col" style={{ animation: "slide-in-left 280ms var(--ease-out)" }}>
        {/* Header */}
        <div className="flex h-9 items-center justify-between border-b border-sidebar-border px-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Recent Archives
          </span>
          <button
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-2 pt-2">
            {/* Favorites */}
            {favoriteItems.length > 0 && (
              <>
                <SectionHeader label="Favorites" count={favoriteItems.length} />
                {favoriteItems.map((item) => (
                  <HistoryItem
                    key={item.path}
                    item={item}
                    isActive={currentArchive === item.path}
                    onOpen={() => {
                      openArchive(item.path);
                      onClose();
                    }}
                    onRemove={() => removeFromHistory(item.path)}
                    onToggleFavorite={() => toggleFavorite(item.path)}
                  />
                ))}
                <div className="mx-2.5 my-2 h-px bg-sidebar-border/50" />
              </>
            )}

            {/* Recent */}
            <SectionHeader label="Recent" count={recentItems.length} />
            {recentItems.length > 0 ? (
              recentItems.map((item) => (
                <HistoryItem
                  key={item.path}
                  item={item}
                  isActive={currentArchive === item.path}
                  onOpen={() => {
                    openArchive(item.path);
                    onClose();
                  }}
                  onRemove={() => removeFromHistory(item.path)}
                  onToggleFavorite={() => toggleFavorite(item.path)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center gap-1.5 px-2.5 py-12">
                <Clock className="h-6 w-6 text-muted-foreground/15" />
                <p className="text-[11px] text-muted-foreground/30">No recent files</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-[9px] tabular-nums text-muted-foreground/25">
          {count}
        </span>
      )}
    </div>
  );
}

function HistoryItem({
  item,
  isActive,
  onOpen,
  onRemove,
  onToggleFavorite,
}: {
  item: HistoryEntry;
  isActive: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onToggleFavorite: () => void;
}) {
  const parentPath = getParentPath(item.path);
  const formatBadgeClass = getFormatBadgeClass(item.format);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "group flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm transition-colors cursor-pointer overflow-hidden",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            )}
            onClick={onOpen}
          />
        }
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted/20">
          <FileArchive className="h-3 w-3 text-muted-foreground/40" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="min-w-0 truncate text-[12px] font-medium">{item.name}</span>
            <span className={cn(
              "shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold uppercase leading-none",
              formatBadgeClass,
            )}>
              {item.format}
            </span>
          </div>
          <p className="truncate text-[10px] text-muted-foreground/35 mt-0.5">
            {parentPath || "Unknown location"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="rounded p-0.5 hover:bg-muted/50 transition-colors"
            title={item.is_favorite ? "Remove from favorites" : "Add to favorites"}
          >
            {item.is_favorite ? (
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            ) : (
              <Star className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded p-0.5 hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-all"
            title="Remove from history"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-muted-foreground/60" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[280px] bg-popover text-popover-foreground border border-border">
        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-sm">{item.name}</p>
          <p className="text-xs text-muted-foreground break-all">{item.path}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="uppercase font-medium">{item.format}</span>
            <span className="text-muted-foreground/30">|</span>
            <span>{formatRelativeTime(item.last_opened)}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;

    const month = date.toLocaleString("en", { month: "short" });
    const day = date.getDate();
    const year = date.getFullYear();
    return year === now.getFullYear()
      ? `${month} ${day}`
      : `${month} ${day}, ${year}`;
  } catch {
    return isoString;
  }
}
