import * as fs from "fs";
import * as jsonc from "jsonc-parser";

export interface StringsIndex {
  /** Flat map: "main_title" → "Welcome". */
  flat: Map<string, string>;
  /** Nested raw tree (for ancestor navigation). */
  tree: Record<string, unknown> | undefined;
}

export function buildStringsIndex(stringsFile: string): StringsIndex {
  if (!fs.existsSync(stringsFile)) return { flat: new Map(), tree: undefined };
  let raw: unknown;
  try {
    raw = jsonc.parse(fs.readFileSync(stringsFile, "utf8"));
  } catch {
    return { flat: new Map(), tree: undefined };
  }
  if (!raw || typeof raw !== "object") return { flat: new Map(), tree: undefined };
  const flat = new Map<string, string>();
  const visit = (node: Record<string, unknown>, prefix: string[]): void => {
    for (const [k, v] of Object.entries(node)) {
      const path = [...prefix, k];
      if (typeof v === "string") {
        flat.set(path.join("_"), v);
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        visit(v as Record<string, unknown>, path);
      }
    }
  };
  visit(raw as Record<string, unknown>, []);
  return { flat, tree: raw as Record<string, unknown> };
}

/** Given a partial "main_title", return direct child keys for the next hop. */
export function stringChildrenAt(index: StringsIndex, pathDotted: string): { key: string; isLeaf: boolean; value?: string }[] {
  if (!index.tree) return [];
  const parts = pathDotted.length > 0 ? pathDotted.split("_") : [];
  let cursor: any = index.tree;
  for (const p of parts) {
    if (!cursor || typeof cursor !== "object" || !(p in cursor)) return [];
    cursor = cursor[p];
    if (typeof cursor === "string") return []; // cannot descend further.
  }
  if (!cursor || typeof cursor !== "object") return [];
  return Object.entries(cursor).map(([key, value]) => ({
    key,
    isLeaf: typeof value === "string",
    value: typeof value === "string" ? value : undefined,
  }));
}
