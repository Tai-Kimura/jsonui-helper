import * as fs from "fs";
import * as path from "path";

type RawType = string | { enum: string[] };
export type AttributeType = "string" | "number" | "boolean" | "binding" | "array" | "object" | { enum: string[] };

export interface AttributeSpec {
  types: AttributeType[];
  enum?: string[];
  description?: string;
  required?: boolean;
  platform?: string;
  mode?: string;
  alias?: string;
  default?: unknown;
}

export interface ComponentAttributeSet {
  /** Attribute map for the component only (not including common). */
  own: Record<string, AttributeSpec>;
}

export interface AttributeCatalog {
  common: Record<string, AttributeSpec>;
  components: Record<string, ComponentAttributeSet>;
  /** Lowercased component name → canonical name. Used to tolerate casing. */
  componentNames: string[];
}

let cached: AttributeCatalog | null = null;

function normalizeRawAttr(raw: any): AttributeSpec {
  const rawType = raw?.type;
  const types: AttributeType[] = [];
  const pushType = (t: RawType) => {
    if (typeof t === "string") {
      if (t === "string" || t === "number" || t === "boolean" || t === "binding" || t === "array" || t === "object") {
        types.push(t);
      } else {
        // Unknown string type: treat as string for safety.
        types.push("string");
      }
    } else if (t && typeof t === "object" && Array.isArray(t.enum)) {
      types.push({ enum: t.enum });
    }
  };
  if (Array.isArray(rawType)) {
    for (const t of rawType) pushType(t);
  } else if (rawType !== undefined) {
    pushType(rawType);
  }
  return {
    types,
    enum: Array.isArray(raw?.enum) ? raw.enum : undefined,
    description: typeof raw?.description === "string" ? raw.description : undefined,
    required: raw?.required === true,
    platform: typeof raw?.platform === "string" ? raw.platform : undefined,
    mode: typeof raw?.mode === "string" ? raw.mode : undefined,
    alias: typeof raw?.alias === "string" ? raw.alias : undefined,
    default: raw?.default,
  };
}

function normalizeSection(section: any): Record<string, AttributeSpec> {
  const out: Record<string, AttributeSpec> = {};
  if (!section || typeof section !== "object") return out;
  for (const [name, raw] of Object.entries(section)) {
    if (name.startsWith("_")) continue;
    out[name] = normalizeRawAttr(raw);
  }
  return out;
}

export function loadAttributeCatalog(extensionRoot: string): AttributeCatalog {
  if (cached) return cached;
  const file = path.join(extensionRoot, "vendor", "attribute_definitions.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const common = normalizeSection(raw.common);
  const components: Record<string, ComponentAttributeSet> = {};
  const names: string[] = [];
  for (const [key, body] of Object.entries(raw)) {
    if (key === "common" || key.startsWith("_")) continue;
    components[key] = { own: normalizeSection(body) };
    names.push(key);
  }
  cached = { common, components, componentNames: names };
  return cached;
}

/** Resolve the full attribute map for a component type (own + common). */
export function attributesFor(catalog: AttributeCatalog, componentType: string | undefined): Record<string, AttributeSpec> {
  const merged: Record<string, AttributeSpec> = { ...catalog.common };
  if (componentType && catalog.components[componentType]) {
    Object.assign(merged, catalog.components[componentType].own);
  }
  return merged;
}

/** Case-insensitive lookup for component names. Accepts aliases like "ScrollView" for "Scroll" if extended. */
export function resolveComponentName(catalog: AttributeCatalog, input: string): string | undefined {
  if (!input) return undefined;
  if (catalog.components[input]) return input;
  const lower = input.toLowerCase();
  return catalog.componentNames.find((n) => n.toLowerCase() === lower);
}
