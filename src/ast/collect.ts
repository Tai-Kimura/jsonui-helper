import * as jsonc from "jsonc-parser";
import { arrayElements, findAtLocation, getValue, objectProperties, propertyValue, type JsonDocument } from "./index";

/**
 * Collect the `id` values of every direct sibling of the component containing the cursor.
 * `jsonPath` should point at a location inside one of the component objects (or the object itself).
 *
 * Heuristic: find the nearest ancestor array in `jsonPath`. Each element of that array, plus
 * the cursor's own element, is considered a sibling.
 */
export function siblingIds(doc: JsonDocument, jsonPath: (string | number)[]): string[] {
  if (!doc.tree) return [];
  const p = [...jsonPath];
  // Walk up to the nearest array index in the path.
  while (p.length > 0) {
    const last = p[p.length - 1];
    if (typeof last === "number") {
      const arrayPath = p.slice(0, -1);
      const arrayNode = findAtLocation(doc, arrayPath);
      if (!arrayNode || arrayNode.type !== "array") return [];
      const ids: string[] = [];
      for (const el of arrayElements(arrayNode)) {
        if (el.type !== "object") continue;
        const idNode = propertyValue(el, "id");
        const v = idNode ? getValue(idNode) : undefined;
        if (typeof v === "string" && v.length > 0) ids.push(v);
      }
      return ids;
    }
    p.pop();
  }
  return [];
}

/**
 * Collect every `data[].name` in a Layout JSON. Useful for @{...} autocomplete.
 * Walks every object recursively looking for a `"data": [{name: "..."}]` array.
 */
export function dataNames(doc: JsonDocument): string[] {
  const out = new Set<string>();
  if (!doc.tree) return [];
  const visit = (node: jsonc.Node) => {
    if (node.type === "object") {
      const dataNode = propertyValue(node, "data");
      if (dataNode?.type === "array") {
        for (const entry of arrayElements(dataNode)) {
          if (entry.type !== "object") continue;
          const nameNode = propertyValue(entry, "name");
          const name = nameNode ? getValue(nameNode) : undefined;
          if (typeof name === "string" && name) out.add(name);
        }
      }
      for (const prop of objectProperties(node)) {
        const value = prop.children?.[1];
        if (value) visit(value);
      }
    } else if (node.type === "array" && node.children) {
      for (const el of node.children) visit(el);
    }
  };
  visit(doc.tree);
  return [...out];
}

/** Walk every component-like object in a layout doc and collect `.id`. */
export function componentIds(doc: JsonDocument): string[] {
  const out = new Set<string>();
  if (!doc.tree) return [];
  const visit = (node: jsonc.Node) => {
    if (node.type === "object") {
      const typeNode = propertyValue(node, "type");
      const idNode = propertyValue(node, "id");
      const hasType = !!typeNode && typeNode.type === "string";
      if (hasType && idNode?.type === "string") {
        const v = getValue(idNode);
        if (typeof v === "string" && v) out.add(v);
      }
      for (const prop of objectProperties(node)) {
        const value = prop.children?.[1];
        if (value) visit(value);
      }
    } else if (node.type === "array" && node.children) {
      for (const el of node.children) visit(el);
    }
  };
  visit(doc.tree);
  return [...out];
}

/**
 * In a screen_spec, collect every `structure.components[].id` recursively.
 * (Different shape from Layout JSON: components are nested via `children`.)
 */
export function specComponentIds(doc: JsonDocument): string[] {
  const out = new Set<string>();
  if (!doc.tree) return [];
  const components = findAtLocation(doc, ["structure", "components"]);
  if (components?.type !== "array") return [];
  const visit = (node: jsonc.Node) => {
    if (node.type !== "object") return;
    const idNode = propertyValue(node, "id");
    const v = idNode ? getValue(idNode) : undefined;
    if (typeof v === "string" && v) out.add(v);
    const children = propertyValue(node, "children");
    if (children?.type === "array") {
      for (const c of arrayElements(children)) visit(c);
    }
  };
  for (const c of arrayElements(components)) visit(c);
  return [...out];
}

/** Spec: repositories[].name in dataFlow (used for useCases[].repositories choice). */
export function repositoryNames(doc: JsonDocument): string[] {
  const out = new Set<string>();
  const node = findAtLocation(doc, ["dataFlow", "repositories"]);
  if (node?.type !== "array") return [];
  for (const r of arrayElements(node)) {
    if (r.type !== "object") continue;
    const nameNode = propertyValue(r, "name");
    const v = nameNode ? getValue(nameNode) : undefined;
    if (typeof v === "string" && v) out.add(v);
  }
  return [...out];
}
