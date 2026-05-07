import * as fs from "fs";
import * as path from "path";
import * as jsonc from "jsonc-parser";
import { relPosix, walk } from "../util/fsIndex";

export interface SpecEntry {
  /** "login.spec.json" or "chat/chat-core.spec.json" (forward slashes). */
  relative: string;
  absolute: string;
  type?: string;
}

export interface SpecIndex {
  all: SpecEntry[];
  /** relative → entry. */
  byRelative: Map<string, SpecEntry>;
  /** Filtered: only component_spec entries. */
  componentSpecs: SpecEntry[];
  /** Filtered: only screen_spec / screen_sub_spec / screen_parent_spec. */
  screenSpecs: SpecEntry[];
}

function readRootType(file: string): string | undefined {
  try {
    const text = fs.readFileSync(file, "utf8");
    const parsed = jsonc.parse(text);
    return typeof parsed?.type === "string" ? parsed.type : undefined;
  } catch {
    return undefined;
  }
}

export function buildSpecIndex(specDirectory: string): SpecIndex {
  const files = walk(specDirectory, { extensions: [".json"] });
  const all: SpecEntry[] = [];
  const byRelative = new Map<string, SpecEntry>();
  for (const full of files) {
    if (!full.endsWith(".spec.json")) continue;
    const relative = relPosix(specDirectory, full);
    const entry: SpecEntry = { relative, absolute: full, type: readRootType(full) };
    all.push(entry);
    byRelative.set(relative, entry);
  }
  all.sort((a, b) => a.relative.localeCompare(b.relative));
  return {
    all,
    byRelative,
    componentSpecs: all.filter((e) => e.type === "component_spec"),
    screenSpecs: all.filter((e) => e.type === "screen_spec" || e.type === "screen_sub_spec" || e.type === "screen_parent_spec"),
  };
}

export function resolveSpecRef(specDirectory: string, ref: string): string | undefined {
  const clean = ref.replace(/^\/+/, "");
  const withExt = clean.endsWith(".json") ? clean : clean + ".spec.json";
  const abs = path.resolve(specDirectory, withExt);
  return fs.existsSync(abs) ? abs : undefined;
}
