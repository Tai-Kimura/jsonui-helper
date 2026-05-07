import * as fs from "fs";
import * as path from "path";

export interface WalkOptions {
  /** Extensions to accept (with leading dot). Others are skipped. */
  extensions?: string[];
  /** Relative directory names to skip entirely. */
  excludeDirs?: string[];
  /** Maximum recursion depth (default 16). */
  maxDepth?: number;
}

/** Recursively list files under `root` matching `options`. Returns absolute paths. */
export function walk(root: string, options: WalkOptions = {}): string[] {
  const { extensions, excludeDirs = ["node_modules", ".git"], maxDepth = 16 } = options;
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const visit = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (excludeDirs.includes(ent.name)) continue;
        visit(full, depth + 1);
      } else if (ent.isFile()) {
        if (!extensions || extensions.includes(path.extname(ent.name))) {
          out.push(full);
        }
      }
    }
  };
  visit(root, 0);
  return out;
}

/** Path relative to `base`, without leading "./", using forward slashes. */
export function relPosix(base: string, full: string): string {
  const rel = path.relative(base, full);
  return rel.split(path.sep).join("/");
}

/** Remove the .json extension (or nothing if not present). */
export function stripJsonExt(file: string): string {
  return file.endsWith(".json") ? file.slice(0, -5) : file;
}
