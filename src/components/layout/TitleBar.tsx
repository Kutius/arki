import { getCurrentWindow } from "@tauri-apps/api/window";
import { Archive, Minus, Square, X } from "lucide-react";
import { cn } from "../../lib/utils";

export function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div className="flex h-9 items-center justify-between border-b bg-background">
      {/* Draggable Title Area */}
      <div className="flex flex-1 items-center gap-1.5 pl-4" data-tauri-drag-region>
        <Archive className="h-3.5 w-3.5 text-muted-foreground/40" data-tauri-drag-region />
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground/50" data-tauri-drag-region>
          Arki
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex h-full">
        <TitleBarButton
          onClick={() => appWindow.minimize()}
          className="hover:bg-muted"
        >
          <Minus className="h-3.5 w-3.5" />
        </TitleBarButton>
        <TitleBarButton
          onClick={() => appWindow.toggleMaximize()}
          className="hover:bg-muted"
        >
          <Square className="h-2.5 w-2.5" />
        </TitleBarButton>
        <TitleBarButton
          onClick={() => appWindow.close()}
          className="hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </TitleBarButton>
      </div>
    </div>
  );
}

function TitleBarButton({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-full w-10 items-center justify-center text-muted-foreground transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}
