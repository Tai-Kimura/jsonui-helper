import * as fs from "fs";
import * as path from "path";
import * as jsonc from "jsonc-parser";

export interface ColorEntry {
  name: string;
  hex?: string;
  source: "colors" | "defined_colors";
}

export interface ColorsIndex {
  entries: ColorEntry[];
  byName: Map<string, ColorEntry>;
}

function loadColorFile(file: string): Record<string, unknown> | undefined {
  if (!fs.existsSync(file)) return undefined;
  try {
    const parsed = jsonc.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export function buildColorsIndex(layoutsDirectory: string): ColorsIndex {
  const entries: ColorEntry[] = [];
  const byName = new Map<string, ColorEntry>();
  const push = (name: string, hex: string | undefined, source: "colors" | "defined_colors") => {
    if (byName.has(name)) return;
    const entry = { name, hex, source };
    entries.push(entry);
    byName.set(name, entry);
  };

  const colorsFile = path.join(layoutsDirectory, "Resources", "colors.json");
  const definedFile = path.join(layoutsDirectory, "Resources", "defined_colors.json");

  const colors = loadColorFile(colorsFile);
  if (colors) {
    for (const [name, value] of Object.entries(colors)) {
      push(name, typeof value === "string" ? value : undefined, "colors");
    }
  }

  const defined = loadColorFile(definedFile);
  if (defined) {
    for (const [name, value] of Object.entries(defined)) {
      // defined_colors.json values can be complex (e.g. {light: "#...", dark: "#..."});
      // keep only a preview hex when we can find one.
      if (typeof value === "string") {
        push(name, value, "defined_colors");
      } else if (value && typeof value === "object") {
        const anyHex = Object.values(value as Record<string, unknown>).find((v) => typeof v === "string");
        push(name, typeof anyHex === "string" ? anyHex : undefined, "defined_colors");
      } else {
        push(name, undefined, "defined_colors");
      }
    }
  }

  return { entries, byName };
}
