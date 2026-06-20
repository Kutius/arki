import {
  Clock,
  FilePlus,
  FolderOutput,
  PanelLeft,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface ToolbarProps {
  archiveName?: string | null;
  format?: string | null;
  hasArchive: boolean;
  isSearchActive: boolean;
  isTreeOpen: boolean;
  onToggleSearch: () => void;
  onToggleTree: () => void;
  onExtract: () => void;
  onCreate: () => void;
  onToggleHistory: () => void;
  onSettings: () => void;
  isHistoryOpen: boolean;
}

export function Toolbar({
  archiveName,
  format,
  hasArchive,
  isSearchActive,
  isTreeOpen,
  onToggleSearch,
  onToggleTree,
  onExtract,
  onCreate,
  onToggleHistory,
  onSettings,
  isHistoryOpen,
}: ToolbarProps) {
  return (
    <div className="flex h-10 shrink-0 items-center border-b bg-background px-3 gap-2">
      {/* Left: Archive info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {archiveName ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-medium truncate">{archiveName}</span>
            {format && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                {format}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[13px] text-muted-foreground/50">Arki</span>
        )}
      </div>

      {/* Center: View toggles (when archive is open) */}
      {hasArchive && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleTree}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  isTreeOpen
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/50",
                )}
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isTreeOpen ? "Hide tree (Ctrl+B)" : "Show tree (Ctrl+B)"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleSearch}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  isSearchActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/50",
                )}
              >
                {isSearchActive ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isSearchActive ? "Close search" : "Search (Ctrl+F)"}
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onExtract}
              disabled={!hasArchive}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors",
                hasArchive
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted-foreground/25 cursor-not-allowed",
              )}
            >
              <FolderOutput className="h-3.5 w-3.5" />
              Extract
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Extract archive (Ctrl+E)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCreate}
              className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <FilePlus className="h-3.5 w-3.5" />
              Create
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Create archive (Ctrl+N)</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleHistory}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                isHistoryOpen
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/50",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Recent archives</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onSettings}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
