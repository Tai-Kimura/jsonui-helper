import * as fs from "fs";
import * as jsonc from "jsonc-parser";

export interface CustomRules {
  /** rules.componentTypes[<category>] — e.g. `screen: ["ProgressBar", "FadeHeroView"]`. */
  componentTypes: Record<string, string[]>;
  fileTypes: string[];
  eventHandlers: {
    allowedNames: string[];
  };
}

export function emptyCustomRules(): CustomRules {
  return { componentTypes: {}, fileTypes: [], eventHandlers: { allowedNames: [] } };
}

export function loadCustomRules(rulesFile: string | undefined): CustomRules {
  if (!rulesFile || !fs.existsSync(rulesFile)) return emptyCustomRules();
  try {
    const raw = jsonc.parse(fs.readFileSync(rulesFile, "utf8"));
    const rules = raw?.rules ?? raw;
    if (!rules || typeof rules !== "object") return emptyCustomRules();
    const componentTypes: Record<string, string[]> = {};
    const rawTypes = rules.componentTypes;
    if (rawTypes && typeof rawTypes === "object") {
      for (const [k, v] of Object.entries(rawTypes)) {
        if (Array.isArray(v)) componentTypes[k] = v.filter((x) => typeof x === "string");
      }
    }
    const fileTypes = Array.isArray(rules.fileTypes) ? (rules.fileTypes.filter((x: unknown) => typeof x === "string") as string[]) : [];
    const handlersRaw = rules.eventHandlers;
    const allowedNames = Array.isArray(handlersRaw?.allowedNames)
      ? (handlersRaw.allowedNames.filter((x: unknown) => typeof x === "string") as string[])
      : [];
    return { componentTypes, fileTypes, eventHandlers: { allowedNames } };
  } catch {
    return emptyCustomRules();
  }
}

/** Flatten all custom component types across categories. */
export function flattenCustomComponentTypes(rules: CustomRules): string[] {
  const out = new Set<string>();
  for (const list of Object.values(rules.componentTypes)) {
    for (const name of list) out.add(name);
  }
  return [...out];
}
