import {
  Clock,
  FilePlus,
  FolderOutput,
  Loader2,
  PanelLeft,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface ToolbarProps {
  archiveName?: string | null;
  format?: string | null;
  hasArchive: boolean;
  isLoading: boolean;
  isSearchActive: boolean;
  isTreeOpen: boolean;
  onToggleSearch: () => void;
  onToggleTree: () => void;
  onExtract: (e?: React.MouseEvent) => void;
  onCreate: () => void;
  onToggleHistory: () => void;
  onSettings: () => void;
  isHistoryOpen: boolean;
}

export function Toolbar({
  archiveName,
  format,
  hasArchive,
  isLoading,
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
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {format}
              </Badge>
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
            <TooltipTrigger
              render={
                <button
                  onClick={onToggleTree}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    isTreeOpen
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/50",
                  )}
                />
              }
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isTreeOpen ? "Hide tree (Ctrl+B)" : "Show tree (Ctrl+B)"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={onToggleSearch}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    isSearchActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/50",
                  )}
                />
              }
            >
              {isSearchActive ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
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
          <TooltipTrigger
            render={
              <button
                onClick={(e) => onExtract(e)}
                disabled={!hasArchive}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors",
                  hasArchive
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "text-muted-foreground/25 cursor-not-allowed",
                )}
              />
            }
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderOutput className="h-3.5 w-3.5" />
            )}
            {isLoading ? "Extracting…" : "Extract"}
          </TooltipTrigger>
          <TooltipContent side="bottom">Extract to folder · Alt+click for options</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={onCreate}
                className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors"
              />
            }
          >
            <FilePlus className="h-3.5 w-3.5" />
            Create
          </TooltipTrigger>
          <TooltipContent side="bottom">Create archive (Ctrl+N)</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={onToggleHistory}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  isHistoryOpen
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/50",
                )}
              />
            }
          >
            <Clock className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Recent archives</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={onSettings}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
              />
            }
          >
            <Settings className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
