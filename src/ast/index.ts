import * as jsonc from "jsonc-parser";

export interface JsonDocument {
  readonly text: string;
  readonly tree: jsonc.Node | undefined;
}

export function parse(text: string): JsonDocument {
  return { text, tree: jsonc.parseTree(text) };
}

/** Wrap jsonc parse errors for diagnostics. */
export function parseWithErrors(text: string): { tree: jsonc.Node | undefined; errors: jsonc.ParseError[] } {
  const errors: jsonc.ParseError[] = [];
  const tree = jsonc.parseTree(text, errors);
  return { tree, errors };
}

export function nodeAt(doc: JsonDocument, offset: number): jsonc.Node | undefined {
  if (!doc.tree) return undefined;
  return jsonc.findNodeAtOffset(doc.tree, offset, true);
}

export function findAtLocation(doc: JsonDocument, path: jsonc.JSONPath): jsonc.Node | undefined {
  if (!doc.tree) return undefined;
  return jsonc.findNodeAtLocation(doc.tree, path);
}

export function getValue(node: jsonc.Node | undefined): unknown {
  if (!node) return undefined;
  return jsonc.getNodeValue(node);
}

export function getLocation(text: string, offset: number): jsonc.Location {
  return jsonc.getLocation(text, offset);
}

/** Return an array node's direct element nodes. */
export function arrayElements(node: jsonc.Node | undefined): jsonc.Node[] {
  if (!node || node.type !== "array" || !node.children) return [];
  return node.children;
}

/** Return the property nodes of an object node (each has children[0]=key, [1]=value). */
export function objectProperties(node: jsonc.Node | undefined): jsonc.Node[] {
  if (!node || node.type !== "object" || !node.children) return [];
  return node.children;
}

export function propertyValue(objectNode: jsonc.Node | undefined, key: string): jsonc.Node | undefined {
  for (const prop of objectProperties(objectNode)) {
    if (prop.children && prop.children[0]?.value === key) {
      return prop.children[1];
    }
  }
  return undefined;
}
