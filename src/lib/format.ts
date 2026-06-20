/**
 * Format bytes into a human-readable string (e.g. "1.5 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export type PreviewType = "text" | "image" | "json" | "xml" | null;

/** Text color class for archive format icons. */
const FORMAT_TEXT_COLORS: Record<string, string> = {
  zip: "text-blue-400",
  "tar.gz": "text-emerald-400",
  tgz: "text-emerald-400",
  "7z": "text-violet-400",
  rar: "text-orange-400",
  gz: "text-amber-400",
  br: "text-cyan-400",
  zst: "text-pink-400",
};

/** Badge classes for archive format labels. */
const FORMAT_BADGE_CLASSES: Record<string, string> = {
  zip: "bg-blue-500/15 text-blue-400",
  "tar.gz": "bg-emerald-500/15 text-emerald-400",
  tgz: "bg-emerald-500/15 text-emerald-400",
  "7z": "bg-violet-500/15 text-violet-400",
  rar: "bg-orange-500/15 text-orange-400",
  gz: "bg-amber-500/15 text-amber-400",
  br: "bg-cyan-500/15 text-cyan-400",
  zst: "bg-pink-500/15 text-pink-400",
};

/** Get Tailwind text color class for a format. */
export function getFormatTextColor(format: string): string {
  return FORMAT_TEXT_COLORS[format] ?? "text-muted-foreground/40";
}

/** Get Tailwind badge classes for a format. */
export function getFormatBadgeClass(format: string): string {
  return FORMAT_BADGE_CLASSES[format] ?? "bg-muted text-muted-foreground";
}

/**
 * Determine the preview type from a filename extension.
 * Used by both the store and DetailPanel for consistent behavior.
 */
export function getPreviewType(filename: string): PreviewType {
  const ext = filename.split(".").pop()?.toLowerCase();
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];
  const jsonExts = ["json"];
  const xmlExts = ["xml"];
  const textExts = [
    "txt", "md", "yaml", "yml", "csv", "toml", "ini", "cfg",
    "conf", "log", "env", "gitignore", "dockerfile", "sh", "bat",
    "ps1", "py", "js", "ts", "jsx", "tsx", "css", "html", "htm",
    "rs", "go", "java", "c", "cpp", "h", "hpp", "rb", "php",
    "sql", "r", "lua", "perl", "pl", "swift", "kt", "scala",
  ];

  if (imageExts.includes(ext || "")) return "image";
  if (jsonExts.includes(ext || "")) return "json";
  if (xmlExts.includes(ext || "")) return "xml";
  if (textExts.includes(ext || "")) return "text";
  return null;
}
