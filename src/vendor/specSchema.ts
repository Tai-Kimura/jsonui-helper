import * as fs from "fs";
import * as path from "path";

export type JsonSchema = any;

export interface SpecSchemas {
  screenSpec: JsonSchema;
  componentSpec: JsonSchema;
}

let cached: SpecSchemas | null = null;

export function loadSpecSchemas(extensionRoot: string): SpecSchemas {
  if (cached) return cached;
  const screen = JSON.parse(fs.readFileSync(path.join(extensionRoot, "vendor", "screen_spec_schema.json"), "utf8"));
  const component = JSON.parse(fs.readFileSync(path.join(extensionRoot, "vendor", "component_spec_schema.json"), "utf8"));
  cached = { screenSpec: screen, componentSpec: component };
  return cached;
}

/**
 * Follow a JSON path (strings for object keys, numbers for arrays) through a
 * JSON Schema, resolving $ref against the schema root whenever encountered.
 * Returns the innermost schema node the path lands on, or undefined.
 */
export function resolveSchemaAtPath(schema: JsonSchema, jsonPath: (string | number)[]): JsonSchema | undefined {
  let node: JsonSchema = schema;
  for (const seg of jsonPath) {
    if (!node) return undefined;
    node = dereference(schema, node);
    if (typeof seg === "string") {
      const next = node?.properties?.[seg];
      if (!next) {
        // Allow additionalProperties with a schema.
        if (node?.additionalProperties && typeof node.additionalProperties === "object") {
          node = node.additionalProperties;
          continue;
        }
        return undefined;
      }
      node = next;
    } else {
      // Array index.
      const items = node?.items;
      if (!items) return undefined;
      node = items;
    }
  }
  return node ? dereference(schema, node) : undefined;
}

export function dereference(root: JsonSchema, node: JsonSchema): JsonSchema {
  let cur = node;
  let guard = 0;
  while (cur && typeof cur === "object" && typeof cur.$ref === "string" && guard++ < 32) {
    cur = resolveRef(root, cur.$ref) ?? cur;
    if (!cur || typeof cur !== "object") break;
    if (!cur.$ref) break;
  }
  return cur;
}

function resolveRef(root: JsonSchema, ref: string): JsonSchema | undefined {
  if (!ref.startsWith("#/")) return undefined;
  const parts = ref.slice(2).split("/").map(decodeURIComponent);
  let node: any = root;
  for (const p of parts) {
    if (!node) return undefined;
    node = node[p];
  }
  return node;
}

/**
 * Return property names directly declared on a (possibly $ref'd) schema node,
 * plus any from oneOf/anyOf/allOf branches, deduped.
 */
export function propertyNames(root: JsonSchema, node: JsonSchema | undefined): string[] {
  if (!node) return [];
  const cur = dereference(root, node);
  const out = new Set<string>();
  if (cur?.properties && typeof cur.properties === "object") {
    for (const k of Object.keys(cur.properties)) out.add(k);
  }
  for (const kw of ["oneOf", "anyOf", "allOf"] as const) {
    const arr = cur?.[kw];
    if (Array.isArray(arr)) {
      for (const sub of arr) {
        for (const n of propertyNames(root, sub)) out.add(n);
      }
    }
  }
  return [...out];
}
