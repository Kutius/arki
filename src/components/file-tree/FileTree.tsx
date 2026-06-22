import {
  ChevronRight,
  FileArchive,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import { getParentPath } from "../../lib/path";
import { getFileIconConfig } from "../../lib/fileIcons";
import type { ArchiveEntry } from "../../store/archiveStore";

interface FileTreeProps {
  entries: ArchiveEntry[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onFileSelect?: (entry: ArchiveEntry) => void;
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  isFile: boolean;
  entry?: ArchiveEntry;
}

export function FileTree({ entries, currentPath, onNavigate, onFileSelect }: FileTreeProps) {
  const tree = useMemo(() => buildTree(entries), [entries]);

  const [manualState, setManualState] = useState<Map<string, boolean>>(new Map());

  const ancestorPaths = useMemo(() => {
    const paths = new Set<string>();
    const normalized = currentPath === "/" ? "" : currentPath.replace(/^\/|\/$/g, "");
    const parts = normalized.split("/").filter(Boolean);

    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      acc += (i > 0 ? "/" : "") + parts[i];
      paths.add("/" + acc);
    }
    return paths;
  }, [currentPath]);

  const isExpanded = useCallback(
    (path: string, depth: number): boolean => {
      if (manualState.has(path)) {
        return manualState.get(path)!;
      }
      if (depth === 0) return true;
      return ancestorPaths.has(path);
    },
    [manualState, ancestorPaths],
  );

  const toggleExpand = useCallback((path: string, depth: number) => {
    setManualState((prev) => {
      const next = new Map(prev);
      const current = isExpanded(path, depth);
      next.set(path, !current);
      return next;
    });
  }, [isExpanded]);

  return (
    <div className="flex h-full w-52 flex-col border-r bg-background">
      <div className="flex h-9 items-center border-b px-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35">
          Structure
        </span>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        <TreeNodeComponent
          node={tree}
          depth={0}
          currentPath={currentPath}
          onNavigate={onNavigate}
          onFileSelect={onFileSelect}
          isExpanded={isExpanded}
          toggleExpand={toggleExpand}
          isRoot
        />
      </div>
    </div>
  );
}

function TreeNodeComponent({
  node,
  depth,
  currentPath,
  onNavigate,
  onFileSelect,
  isExpanded,
  toggleExpand,
  isRoot = false,
}: {
  node: TreeNode;
  depth: number;
  currentPath: string;
  onNavigate: (path: string) => void;
  onFileSelect?: (entry: ArchiveEntry) => void;
  isExpanded: (path: string, depth: number) => boolean;
  toggleExpand: (path: string, depth: number) => void;
  isRoot?: boolean;
}) {
  const expanded = isExpanded(node.path, depth);
  const isActive = currentPath === node.path || (isRoot && currentPath === "/");
  const hasChildren = node.children.length > 0;
  const paddingLeft = isRoot ? 8 : depth * 14 + 8;

  const handleClick = () => {
    if (node.isFile) {
      // Navigate to parent directory and select the file
      const parentPath = getParentPath(node.path) || "/";
      onNavigate(parentPath);
      if (node.entry) {
        onFileSelect?.(node.entry);
      }
    } else {
      if (hasChildren) {
        toggleExpand(node.path, depth);
      }
      onNavigate(node.path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex h-[24px] cursor-pointer items-center gap-1 pr-2 transition-colors",
          "hover:bg-accent/50",
          isActive && "bg-accent",
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {/* Expand chevron or indent spacer */}
        {node.isFile ? (
          <div className="w-3 shrink-0" />
        ) : hasChildren ? (
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
        ) : (
          <div className="w-3 shrink-0" />
        )}

        {/* Icon */}
        {isRoot ? (
          <FileArchive className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        ) : node.isFile ? (
          <FileTreeIcon name={node.name} />
        ) : expanded && hasChildren ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-blue-400/70" />
        )}

        {/* Label */}
        <span
          className={cn(
            "min-w-0 truncate text-[12px]",
            isRoot ? "font-medium text-foreground/60" : "text-foreground/50",
            isActive && "text-foreground/80",
          )}
        >
          {isRoot ? "Root" : node.name}
        </span>
      </div>

      {hasChildren && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.path}
                node={child}
                depth={depth + 1}
                currentPath={currentPath}
                onNavigate={onNavigate}
                onFileSelect={onFileSelect}
                isExpanded={isExpanded}
                toggleExpand={toggleExpand}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FileTreeIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const config = getFileIconConfig(ext);
  const Icon = config.icon;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", config.color)} />;
}

function buildTree(entries: ArchiveEntry[]): TreeNode {
  const root: TreeNode = {
    name: "Root",
    path: "/",
    children: [],
    isFile: false,
  };

  const dirMap = new Map<string, TreeNode>();
  dirMap.set("/", root);

  // Collect directories from explicit directory entries
  for (const entry of entries) {
    const normalizedPath = entry.path.replace(/\\/g, "/").replace(/^\/|\/$/g, "");
    if (!normalizedPath) continue; // skip root entries

    if (entry.isDirectory) {
      const dirPath = "/" + normalizedPath;
      if (!dirMap.has(dirPath)) {
        dirMap.set(dirPath, {
          name: entry.name,
          path: dirPath,
          children: [],
          isFile: false,
        });
      }
    }
  }

  // Create virtual directories from nested file paths, and collect files
  const files: TreeNode[] = [];

  for (const entry of entries) {
    const normalizedPath = entry.path.replace(/\\/g, "/").replace(/^\/|\/$/g, "");
    if (!normalizedPath) continue;

    if (entry.isDirectory) continue;

    const parts = normalizedPath.split("/");

    // Create intermediate directories
    for (let i = 1; i < parts.length; i++) {
      const dirPath = "/" + parts.slice(0, i).join("/");
      if (!dirMap.has(dirPath)) {
        dirMap.set(dirPath, {
          name: parts[i - 1],
          path: dirPath,
          children: [],
          isFile: false,
        });
      }
    }

    // Create file node
    files.push({
      name: entry.name,
      path: "/" + normalizedPath,
      children: [],
      isFile: true,
      entry,
    });
  }

  // Build directory parent-child relationships
  const sortedDirs = Array.from(dirMap.entries())
    .filter(([path]) => path !== "/")
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [path, node] of sortedDirs) {
    const parentPath = getParentPath(path) || "/";
    const parent = dirMap.get(parentPath) || root;

    if (!parent.children.some((c) => c.path === node.path)) {
      parent.children.push(node);
    }
  }

  // Attach files to their parent directories, skip if a directory with the same path exists
  for (const fileNode of files) {
    // Skip if there's already a directory with the same path (shouldn't happen, but defensive)
    if (dirMap.has(fileNode.path)) continue;
    const parentPath = getParentPath(fileNode.path) || "/";
    const parent = dirMap.get(parentPath) || root;
    // Skip if parent already has a child with the same name that's a directory
    if (parent.children.some((c) => c.name === fileNode.name && !c.isFile)) continue;
    parent.children.push(fileNode);
  }

  // Sort children: directories first, then files, each alphabetically
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => {
      // Directories first
      if (!a.isFile && b.isFile) return -1;
      if (a.isFile && !b.isFile) return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
  };
  sortChildren(root);

  return root;
}
