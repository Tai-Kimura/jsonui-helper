import * as jsonc from "jsonc-parser";
import type { DocumentKind } from "../config/documentKind";
import { arrayElements, findAtLocation, getLocation, getValue, nodeAt, objectProperties, parse, type JsonDocument } from "./index";

export type PositionKind =
  | "propertyName"
  | "propertyValue"
  | "stringContent"
  | "arrayElement"
  | "emptyObject"
  | "none";

export interface CursorContext {
  documentKind: DocumentKind;
  document: JsonDocument;
  offset: number;
  positionKind: PositionKind;
  jsonPath: (string | number)[];
  /** Character directly before the cursor. Useful for "@" binding detection. */
  previousChar: string;
  /** Name of the property whose value we're in, if `positionKind` is a value kind. */
  parentProperty?: string;
  /** `"type"` value of the nearest ancestor Layout component (or the current component). */
  enclosingComponent?: string;
  /** Whole current string literal node, when inside one. */
  stringNode?: jsonc.Node;
  /** Arbitrary anchor node: the node at cursor (falls back to nearest container). */
  node?: jsonc.Node;
}

function previousNonWhitespace(text: string, offset: number): string {
  for (let i = offset - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") return ch;
  }
  return "";
}

function stripTrailingIndex(p: (string | number)[]): (string | number)[] {
  const out = [...p];
  while (out.length > 0 && typeof out[out.length - 1] === "number") out.pop();
  return out;
}

function enclosingComponentType(doc: JsonDocument, jsonPath: (string | number)[]): string | undefined {
  if (!doc.tree) return undefined;
  // Walk up the path, asking for the "type" of each object ancestor.
  const path = [...jsonPath];
  while (true) {
    const container = path.length === 0 ? doc.tree : findAtLocation(doc, path);
    if (container && container.type === "object") {
      const typeValue = getValue(containerProperty(container, "type"));
      if (typeof typeValue === "string") return typeValue;
    }
    if (path.length === 0) return undefined;
    path.pop();
  }
}

function containerProperty(objNode: jsonc.Node, key: string): jsonc.Node | undefined {
  for (const p of objectProperties(objNode)) {
    if (p.children?.[0]?.value === key) return p.children[1];
  }
  return undefined;
}

export function buildCursorContext(text: string, offset: number, documentKind: DocumentKind): CursorContext {
  const doc = parse(text);
  const loc = getLocation(text, offset);
  const jsonPath = loc.path.slice() as (string | number)[];

  const prev = previousNonWhitespace(text, offset);
  const node = nodeAt(doc, offset);

  let positionKind: PositionKind = "none";
  let parentProperty: string | undefined;
  let stringNode: jsonc.Node | undefined;

  if (loc.isAtPropertyKey) {
    positionKind = "propertyName";
  } else if (node?.type === "string") {
    // Cursor is inside or at the boundary of a string literal.
    stringNode = node;
    positionKind = "stringContent";
    const last = jsonPath[jsonPath.length - 1];
    if (typeof last === "string") parentProperty = last;
  } else {
    // Not inside a string. Decide based on the path & the character context.
    const last = jsonPath[jsonPath.length - 1];
    if (typeof last === "number") {
      positionKind = "arrayElement";
    } else if (typeof last === "string") {
      // We may be at a property-value slot (after the `:`), or inside an object literal that belongs to a property.
      positionKind = "propertyValue";
      parentProperty = last;
    } else {
      // Top-level.
      positionKind = "none";
    }
    // `{` directly before cursor → empty-object insertion context.
    if (prev === "{" || prev === ",") {
      // Only treat as emptyObject when we're inside an object node (not inside an array that starts new object-like position).
      // Path ending with a string property name means we're in a value position; `{` after `:` is still a value position with empty object started.
      if (positionKind === "propertyValue" || positionKind === "arrayElement" || positionKind === "none") {
        // Detect actual `{` container: scan nearest object node.
        if (node?.type === "object" && node.children?.length === 0) {
          positionKind = "emptyObject";
        } else if (prev === "{") {
          positionKind = "emptyObject";
        }
      }
    }
  }

  const enclosing = enclosingComponentType(doc, stripTrailingIndex(jsonPath));

  return {
    documentKind,
    document: doc,
    offset,
    positionKind,
    jsonPath,
    previousChar: prev,
    parentProperty,
    enclosingComponent: enclosing,
    stringNode,
    node,
  };
}

/**
 * When the cursor sits inside a string literal, return the text between the
 * opening quote and the cursor offset. Useful for partial-value filtering
 * (colors, strings, include paths, binding names, ...).
 */
export function currentStringPrefix(context: CursorContext): string | undefined {
  if (!context.stringNode) return undefined;
  const start = context.stringNode.offset + 1; // skip opening quote
  const end = Math.min(context.offset, context.stringNode.offset + context.stringNode.length - 1);
  if (end < start) return "";
  return context.document.text.slice(start, end);
}

/** Returns true when the cursor is immediately after `@{` inside a string. */
export function isInsideBindingExpression(context: CursorContext): boolean {
  const prefix = currentStringPrefix(context);
  if (prefix === undefined) return false;
  const idx = prefix.lastIndexOf("@{");
  if (idx === -1) return false;
  // Make sure there is no closing `}` after the `@{`.
  return !prefix.slice(idx + 2).includes("}");
}

/** Returns the partial binding name typed after `@{`. */
export function bindingPrefix(context: CursorContext): string | undefined {
  const prefix = currentStringPrefix(context);
  if (prefix === undefined) return undefined;
  const idx = prefix.lastIndexOf("@{");
  if (idx === -1) return undefined;
  return prefix.slice(idx + 2);
}

/** Extract each element node of an array at `jsonPath`, if it exists. */
export function arrayAt(doc: JsonDocument, jsonPath: (string | number)[]): jsonc.Node[] {
  const node = findAtLocation(doc, jsonPath);
  return arrayElements(node);
}

/** Return the immediate parent object node of a given JSON path. */
export function parentObject(doc: JsonDocument, jsonPath: (string | number)[]): jsonc.Node | undefined {
  const p = [...jsonPath];
  while (p.length > 0) {
    p.pop();
    const n = findAtLocation(doc, p);
    if (n?.type === "object") return n;
    if (n?.type === "array") continue;
  }
  return doc.tree && doc.tree.type === "object" ? doc.tree : undefined;
}
