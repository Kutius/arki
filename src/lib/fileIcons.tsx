import {
  File,
  FileArchive,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  Image,
  Presentation,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

interface IconConfig {
  icon: LucideIcon;
  color: string;
}

/**
 * Get the icon and color for a file based on its extension.
 * Shared across FileListView, FileTree, and CreateArchiveDialog.
 */
export function getFileIconConfig(ext: string | undefined): IconConfig {
  switch (ext) {
    case "zip":
    case "7z":
    case "rar":
    case "tar":
    case "gz":
    case "bz2":
    case "br":
    case "zst":
    case "tgz":
      return { icon: FileArchive, color: "text-amber-400/70" };
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
    case "svg":
    case "bmp":
    case "ico":
    case "tiff":
      return { icon: Image, color: "text-pink-400/70" };
    case "json":
      return { icon: FileJson, color: "text-yellow-400/70" };
    case "js":
    case "ts":
    case "tsx":
    case "jsx":
    case "py":
    case "rs":
    case "go":
    case "java":
    case "c":
    case "cpp":
    case "h":
    case "hpp":
    case "rb":
    case "php":
    case "html":
    case "css":
    case "scss":
    case "vue":
    case "svelte":
      return { icon: FileCode, color: "text-emerald-400/70" };
    case "xls":
    case "xlsx":
    case "csv":
      return { icon: FileSpreadsheet, color: "text-green-400/70" };
    case "ppt":
    case "pptx":
      return { icon: Presentation, color: "text-orange-400/70" };
    case "pdf":
    case "doc":
    case "docx":
    case "rtf":
    case "odt":
      return { icon: FileType, color: "text-red-400/70" };
    case "txt":
    case "md":
    case "xml":
    case "yaml":
    case "yml":
    case "toml":
    case "ini":
    case "cfg":
    case "log":
      return { icon: FileText, color: "text-muted-foreground/60" };
    default:
      return { icon: File, color: "text-muted-foreground/50" };
  }
}

/**
 * Render a file icon based on the filename extension.
 */
export function FileIcon({ name, className }: { name: string; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const config = getFileIconConfig(ext);
  const Icon = config.icon;
  return <Icon className={cn("h-4 w-4 shrink-0", config.color, className)} />;
}

