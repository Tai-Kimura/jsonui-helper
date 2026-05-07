import * as vscode from "vscode";
import type { CursorContext } from "../../ast/cursor";
import type { ExtensionServices } from "../../services";
import { concreteTypeNames, genericPatterns } from "../../vendor/typeMap";

/**
 * Inside a `data[]` array: suggest the three well-known property names (`name`/`class`/`defaultValue`),
 * plus type candidates in the `class` value position.
 */
export function provideLayoutData(context: CursorContext, services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  const path = context.jsonPath;
  const dataIdx = path.lastIndexOf("data");
  if (dataIdx === -1) return [];

  if (context.positionKind === "propertyName") {
    // Inside data[].<property name position>.
    const keys = ["name", "class", "defaultValue"];
    return keys.map((k) => {
      const item = new vscode.CompletionItem(k, vscode.CompletionItemKind.Property);
      item.detail = "data binding property";
      item.insertText = k;
      return item;
    });
  }

  if (context.parentProperty === "class") {
    const idx = services.indexesFor(uri);
    if (!idx) return [];
    const concrete = concreteTypeNames(idx.typeNames.snapshot);
    const patterns = genericPatterns(idx.typeNames.snapshot);
    const items: vscode.CompletionItem[] = [];
    for (const name of concrete) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
      item.detail = "type";
      item.insertText = name;
      items.push(item);
    }
    for (const p of patterns) {
      const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.TypeParameter);
      item.detail = "generic pattern";
      item.insertText = p;
      item.sortText = `1_${p}`;
      items.push(item);
    }
    return items;
  }
  return [];
}
