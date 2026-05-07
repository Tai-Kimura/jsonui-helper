import * as fs from "fs";
import * as path from "path";
import { walk } from "../util/fsIndex";

export interface ImageIndex {
  /** Basenames without extension. */
  names: string[];
  /** name → absolute path (SVG). */
  absolute: Map<string, string>;
}

export function buildImageIndex(imagesDirectory: string): ImageIndex {
  const names: string[] = [];
  const absolute = new Map<string, string>();
  if (!fs.existsSync(imagesDirectory)) return { names, absolute };
  for (const full of walk(imagesDirectory, { extensions: [".svg"] })) {
    const base = path.basename(full, ".svg");
    if (!absolute.has(base)) {
      names.push(base);
      absolute.set(base, full);
    }
  }
  names.sort();
  return { names, absolute };
}
