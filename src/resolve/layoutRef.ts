import * as fs from "fs";
import * as path from "path";
import { relPosix, stripJsonExt, walk } from "../util/fsIndex";

export interface LayoutIndex {
  /** "bar_list/bar_cell" (without extension, forward slashes). */
  entries: string[];
  /** Map entry → absolute path, for Definition provider. */
  absolute: Map<string, string>;
}

/**
 * Build a LayoutIndex from the `layouts_directory`. Excludes `Styles/`,
 * `Resources/` (strings/colors) and `Images/` from candidates so that only
 * "includable" layouts remain.
 */
export function buildLayoutIndex(layoutsDirectory: string): LayoutIndex {
  const files = walk(layoutsDirectory, {
    extensions: [".json"],
    excludeDirs: ["node_modules", ".git", "Styles", "Resources", "Images"],
  });
  const entries: string[] = [];
  const absolute = new Map<string, string>();
  for (const full of files) {
    const rel = relPosix(layoutsDirectory, full);
    const entry = stripJsonExt(rel);
    entries.push(entry);
    absolute.set(entry, full);
  }
  entries.sort();
  return { entries, absolute };
}

/** Resolve an include-style reference ("bar_list/bar_cell") against `layouts_directory`. */
export function resolveLayoutRef(layoutsDirectory: string, ref: string): string | undefined {
  const clean = ref.replace(/^\/+/, "").replace(/\.json$/i, "");
  const abs = path.join(layoutsDirectory, clean + ".json");
  return fs.existsSync(abs) ? abs : undefined;
}
