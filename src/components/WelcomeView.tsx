import { useRef } from "react";
import {
  Archive,
  FileArchive,
  FolderOpen,
  Plus,
  Star,
} from "lucide-react";
import { cn } from "../lib/utils";
import { getParentPath } from "../lib/path";
import { getFormatTextColor } from "../lib/format";
import { useViewEntrance } from "../lib/animations";
import { useArchiveStore } from "../store/archiveStore";
import type { HistoryEntry } from "../store/archiveStore";

interface WelcomeViewProps {
  onCreate: () => void;
}

export function WelcomeView({ onCreate }: WelcomeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { history, openArchive, toggleFavorite } = useArchiveStore();

  const favoriteItems = history.filter((h) => h.is_favorite);
  const recentItems = history.filter((h) => !h.is_favorite).slice(0, 8);
  const hasHistory = favoriteItems.length > 0 || recentItems.length > 0;

  // Coordinated entrance animation
  useViewEntrance(containerRef, { deps: [] });

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto">
      <div ref={containerRef} className="flex w-full max-w-2xl flex-col items-center px-8 pt-16 pb-12">
        {/* Hero */}
        <div data-entrance="hero" className="flex flex-col items-center gap-4 mb-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
            <Archive className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.5} />
          </div>
          <div className="text-center space-y-1.5">
            <h1 className="text-[15px] font-medium text-foreground/60">Open an archive</h1>
            <p className="text-[12px] text-muted-foreground/35">
              Drop a file here, or choose from below
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div data-entrance="actions" className="flex gap-3 mb-10">
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary/90 px-5 py-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary active:scale-[0.98] transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Archive
          </button>
        </div>

        {/* Recent Files */}
        {hasHistory && (
          <div data-entrance="content" className="w-full">
            {/* Favorites */}
            {favoriteItems.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-1.5 mb-3">
                  <Star className="h-3 w-3 text-primary/50" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35">
                    Favorites
                  </span>
                </div>
                <div className="grid gap-1.5">
                  {favoriteItems.map((item) => (
                    <RecentFileRow
                      key={item.path}
                      item={item}
                      stagger
                      onOpen={() => openArchive(item.path)}
                      onToggleFavorite={() => toggleFavorite(item.path)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent */}
            {recentItems.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <FolderOpen className="h-3 w-3 text-muted-foreground/30" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35">
                    Recent
                  </span>
                </div>
                <div className="grid gap-1">
                  {recentItems.map((item) => (
                    <RecentFileRow
                      key={item.path}
                      item={item}
                      stagger
                      onOpen={() => openArchive(item.path)}
                      onToggleFavorite={() => toggleFavorite(item.path)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty history */}
        {!hasHistory && (
          <div className="flex flex-col items-center gap-2 mt-4 text-muted-foreground/20">
            <FolderOpen className="h-5 w-5" />
            <p className="text-[11px]">No recent files yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentFileRow({
  item,
  stagger,
  onOpen,
  onToggleFavorite,
}: {
  item: HistoryEntry;
  stagger?: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const parentPath = getParentPath(item.path);
  const iconColor = getFormatTextColor(item.format);

  return (
    <div
      data-stagger={stagger ? "" : undefined}
      className="group flex h-10 items-center gap-3 rounded-lg px-3 cursor-pointer hover:bg-accent/60 transition-colors"
      onClick={onOpen}
    >
      <FileArchive className={cn("h-4 w-4 shrink-0", iconColor)} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium truncate">{item.name}</span>
          <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground/40">
            {item.format}
          </span>
        </div>
      </div>

      <span className="text-[11px] text-muted-foreground/30 truncate max-w-[200px]">
        {parentPath}
      </span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted/50 transition-all"
        title={item.is_favorite ? "Remove from favorites" : "Add to favorites"}
      >
        {item.is_favorite ? (
          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
        ) : (
          <Star className="h-3.5 w-3.5 text-muted-foreground/25" />
        )}
      </button>
    </div>
  );
}
