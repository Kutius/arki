import {
  Archive,
  Clock,
  HardDrive,
  Settings,
  Star,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <div className={cn("flex h-full w-56 flex-col border-r bg-background", className)}>
      {/* App Title */}
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <Archive className="h-5 w-5 text-foreground" />
        <span className="text-sm font-semibold tracking-tight text-foreground">
          SoZip
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {/* Recent Section */}
          <div className="px-2 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Recent
            </span>
          </div>

          <NavItem icon={Clock} label="Recent Files" active />
          <NavItem icon={Star} label="Favorites" />

          <Separator className="my-2" />

          {/* Formats Section */}
          <div className="px-2 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Formats
            </span>
          </div>

          <NavItem icon={Archive} label="ZIP Archives" />
          <NavItem icon={Archive} label="7z Archives" />
          <NavItem icon={Archive} label="TAR Archives" />
          <NavItem icon={Archive} label="RAR Archives" />
        </div>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="border-t p-2">
        <NavItem icon={HardDrive} label="Storage Info" />
        <NavItem icon={Settings} label="Settings" />
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </button>
  );
}
