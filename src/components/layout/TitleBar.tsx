import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { cn } from "../../lib/utils";

export function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div className="flex h-10 items-center justify-between border-b bg-background">
      {/* Draggable Title Area */}
      <div className="flex flex-1 items-center gap-2 pl-4" data-tauri-drag-region>
        <span className="text-xs font-medium text-muted-foreground" data-tauri-drag-region>
          SoZip
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex h-full">
        <TitleBarButton
          onClick={() => appWindow.minimize()}
          className="hover:bg-muted"
        >
          <Minus className="h-4 w-4" />
        </TitleBarButton>
        <TitleBarButton
          onClick={() => appWindow.toggleMaximize()}
          className="hover:bg-muted"
        >
          <Square className="h-3 w-3" />
        </TitleBarButton>
        <TitleBarButton
          onClick={() => appWindow.close()}
          className="hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-4 w-4" />
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
        "inline-flex h-full w-11 items-center justify-center text-muted-foreground transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}
