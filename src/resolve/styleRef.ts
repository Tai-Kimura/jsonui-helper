import * as fs from "fs";
import * as path from "path";
import { walk } from "../util/fsIndex";

export interface StyleIndex {
  /** Basenames without extension. */
  names: string[];
  /** name → absolute path. */
  absolute: Map<string, string>;
}

/**
 * Build a StyleIndex. Styles live under either `layouts_directory/Styles/` (source of truth)
 * or `styles_directory` (a dedicated folder). Both are scanned if present.
 */
export function buildStyleIndex(layoutsDirectory: string, stylesDirectory: string): StyleIndex {
  const names: string[] = [];
  const absolute = new Map<string, string>();
  const roots = [path.join(layoutsDirectory, "Styles"), stylesDirectory];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const full of walk(root, { extensions: [".json"] })) {
      const base = path.basename(full, ".json");
      if (!absolute.has(base)) {
        names.push(base);
        absolute.set(base, full);
      }
    }
  }
  names.sort();
  return { names, absolute };
}

export function resolveStyleRef(index: StyleIndex, ref: string): string | undefined {
  const clean = ref.replace(/\.json$/i, "");
  return index.absolute.get(clean);
}
