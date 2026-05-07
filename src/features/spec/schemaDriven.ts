import * as vscode from "vscode";
import type { CursorContext } from "../../ast/cursor";
import { dereference, propertyNames, resolveSchemaAtPath, type JsonSchema } from "../../vendor/specSchema";

function descriptionOf(schema: JsonSchema | undefined): string | undefined {
  if (!schema) return undefined;
  if (typeof schema.description === "string") return schema.description;
  return undefined;
}

function buildValueSnippetFromSchema(schema: JsonSchema | undefined, rootSchema: JsonSchema): string {
  if (!schema) return `"\${1:}"`;
  const node = dereference(rootSchema, schema);
  if (node?.const !== undefined) {
    if (typeof node.const === "string") return `"${node.const}"`;
    return String(node.const);
  }
  if (Array.isArray(node?.enum)) {
    const joined = node.enum.map((e: unknown) => String(e)).join(",");
    const allStrings = node.enum.every((e: unknown) => typeof e === "string");
    return allStrings ? `"\${1|${joined}|}"` : `\${1|${joined}|}`;
  }
  const type = node?.type;
  if (type === "string") return `"\${1:}"`;
  if (type === "number" || type === "integer") return `\${1:0}`;
  if (type === "boolean") return `\${1|true,false|}`;
  if (type === "array") return `[\${1}]`;
  if (type === "object") {
    const required: string[] = Array.isArray(node.required) ? node.required : [];
    if (required.length === 0) return `{\${1}}`;
    const parts = required
      .map((name, i) => {
        const child = node.properties?.[name];
        const inner = buildValueSnippetFromSchema(child, rootSchema).replace(/\$\{1/g, `\${${i + 1}`);
        return `\t"${name}": ${inner}`;
      })
      .join(",\n");
    return `{\n${parts}\n}`;
  }
  return `"\${1:}"`;
}

/**
 * Provide property-name completions driven by the JSON Schema at the current
 * cursor's JSON path. Returns names from `properties`, plus values from
 * `oneOf/anyOf/allOf` branches, de-duplicated.
 */
export function provideSchemaPropertyNames(context: CursorContext, rootSchema: JsonSchema): vscode.CompletionItem[] {
  if (context.positionKind !== "propertyName") return [];
  // Path without the property key we're typing: drop trailing string segment if present.
  const schemaPath = [...context.jsonPath];
  const node = resolveSchemaAtPath(rootSchema, schemaPath);
  const names = propertyNames(rootSchema, node);
  const items: vscode.CompletionItem[] = [];
  for (const name of names) {
    const propSchema = node?.properties?.[name];
    const desc = descriptionOf(propSchema);
    const nameItem = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
    nameItem.insertText = name;
    if (desc) nameItem.documentation = new vscode.MarkdownString(desc);
    items.push(nameItem);

    const snippet = new vscode.CompletionItem(`${name}  (with value)`, vscode.CompletionItemKind.Snippet);
    snippet.filterText = name;
    snippet.sortText = `1_${name}`;
    if (desc) snippet.documentation = new vscode.MarkdownString(desc);
    const valueSnippet = buildValueSnippetFromSchema(propSchema, rootSchema);
    snippet.insertText = new vscode.SnippetString(`"${name}": ${valueSnippet}`);
    items.push(snippet);
  }
  return items;
}

/** For schema nodes describing an enum string, return the enum values as completions. */
export function provideSchemaEnumValues(context: CursorContext, rootSchema: JsonSchema): vscode.CompletionItem[] {
  if (context.positionKind !== "propertyValue" && context.positionKind !== "stringContent" && context.positionKind !== "arrayElement") {
    return [];
  }
  const node = resolveSchemaAtPath(rootSchema, context.jsonPath);
  if (!node) return [];
  const enumVals = node.enum;
  if (!Array.isArray(enumVals)) return [];
  return enumVals.map((v) => {
    const s = String(v);
    const item = new vscode.CompletionItem(s, vscode.CompletionItemKind.EnumMember);
    item.insertText = s;
    return item;
  });
}
