/**
 * Extract the parent directory from a path, handling both \ and / separators.
 * Returns "" if the path has no parent (root-level).
 */
export function getParentPath(path: string): string {
  if (path.includes("\\")) {
    const idx = path.lastIndexOf("\\");
    return idx > 0 ? path.substring(0, idx) : "";
  }
  if (path.includes("/")) {
    const idx = path.lastIndexOf("/");
    return idx > 0 ? path.substring(0, idx) : "";
  }
  return "";
}
