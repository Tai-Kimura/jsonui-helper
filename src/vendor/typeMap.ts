import * as fs from "fs";
import * as path from "path";

export interface TypeMapEntry {
  class?: string;
  defaultValue?: unknown;
  imports?: string[];
  ios?: TypeMapEntry;
  android?: TypeMapEntry;
  web?: TypeMapEntry;
}

export interface TypeMapSnapshot {
  /** Built-in + project override, keyed by spec type name (may contain generic patterns). */
  types: Record<string, TypeMapEntry>;
  /** True when a project-local `.jsonui-type-map.json` was merged in. */
  hasProjectOverride: boolean;
}

let builtinCache: Record<string, TypeMapEntry> | null = null;

export function loadBuiltinTypeMap(extensionRoot: string): Record<string, TypeMapEntry> {
  if (builtinCache) return builtinCache;
  const file = path.join(extensionRoot, "vendor", "builtin_type_map.json");
  builtinCache = JSON.parse(fs.readFileSync(file, "utf8"));
  return builtinCache!;
}

/** Merge a project-local `.jsonui-type-map.json` on top of the built-ins. */
export function mergeProjectTypeMap(extensionRoot: string, projectFile: string | undefined): TypeMapSnapshot {
  const builtin = loadBuiltinTypeMap(extensionRoot);
  const merged: Record<string, TypeMapEntry> = { ...builtin };
  let hasOverride = false;
  if (projectFile && fs.existsSync(projectFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(projectFile, "utf8"));
      if (raw?.types && typeof raw.types === "object") {
        Object.assign(merged, raw.types);
        hasOverride = true;
      }
    } catch {
      /* malformed user file: ignore silently for completion */
    }
  }
  return { types: merged, hasProjectOverride: hasOverride };
}

/** Names that are pure (non-generic) keys in the type map. */
export function concreteTypeNames(snapshot: TypeMapSnapshot): string[] {
  return Object.keys(snapshot.types).filter((k) => !k.includes("$"));
}

/** Pattern keys (contain `$T`-style variables). */
export function genericPatterns(snapshot: TypeMapSnapshot): string[] {
  return Object.keys(snapshot.types).filter((k) => k.includes("$"));
}
