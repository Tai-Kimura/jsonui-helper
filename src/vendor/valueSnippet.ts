import * as vscode from "vscode";
import type { AttributeSpec, AttributeType } from "./attributes";

export interface SnippetBuildOptions {
  /** Whether the cursor is already inside `"..."` (after the opening quote). */
  insideQuotes: boolean;
  /** Whether the `: ` separator still needs to be emitted. */
  emitColon: boolean;
  /** Property name (only for onClick/on* heuristics). */
  propertyName?: string;
}

function collectEnum(spec: AttributeSpec): string[] | undefined {
  if (spec.enum && spec.enum.length > 0) return spec.enum;
  for (const t of spec.types) {
    if (typeof t === "object" && "enum" in t) return t.enum;
  }
  return undefined;
}

function supportsBinding(spec: AttributeSpec): boolean {
  return spec.types.includes("binding");
}

function supportsType(spec: AttributeSpec, kind: AttributeType): boolean {
  return spec.types.some((t) => t === kind);
}

/** Produce a value-only snippet (e.g. `"center"` or `${1:0}`) matching the attribute. */
export function buildValueSnippet(spec: AttributeSpec, propertyName: string): string {
  const enumVals = collectEnum(spec);
  if (enumVals && enumVals.length > 0) {
    return `"\${1|${enumVals.join(",")}|}"`;
  }
  if (/^on[A-Z]/.test(propertyName)) {
    return `"@{\${1:handler}}"`;
  }
  if (supportsType(spec, "boolean") && !supportsType(spec, "number") && !supportsType(spec, "string")) {
    return `\${1|true,false|}`;
  }
  if (supportsType(spec, "number") && !supportsType(spec, "string")) {
    return `\${1:0}`;
  }
  if (supportsType(spec, "array")) {
    return `[\${1}]`;
  }
  if (supportsType(spec, "object")) {
    return `{\${1}}`;
  }
  if (supportsBinding(spec) && !supportsType(spec, "string")) {
    return `"@{\${1:value}}"`;
  }
  return `"\${1:}"`;
}

/** Produce a full property-name + value snippet (e.g. `"fontSize": ${1:16}`). */
export function buildPropertySnippet(name: string, spec: AttributeSpec): string {
  const value = buildValueSnippet(spec, name);
  return `"${name}": ${value}`;
}

export function toCompletionItem(name: string, spec: AttributeSpec): vscode.CompletionItem {
  const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
  if (spec.description) item.documentation = new vscode.MarkdownString(spec.description);
  if (spec.required) item.detail = "required";
  return item;
}
