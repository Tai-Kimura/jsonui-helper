import * as vscode from "vscode";
import type { CursorContext } from "../../ast/cursor";
import type { ExtensionServices } from "../../services";
import { attributesFor, resolveComponentName } from "../../vendor/attributes";
import { buildPropertySnippet, toCompletionItem } from "../../vendor/valueSnippet";

/**
 * `"responsive": { "<sizeClass>": { ...attributes } }` — scope-aware completion:
 *   - Size class keys directly inside `responsive`.
 *   - Component attribute names inside a nested block.
 */
export function provideResponsive(context: CursorContext, services: ExtensionServices): vscode.CompletionItem[] {
  if (context.positionKind !== "propertyName") return [];
  const path = context.jsonPath;
  const idx = path.lastIndexOf("responsive");
  if (idx === -1) return [];

  if (path.length === idx + 1) {
    return services.sizeClasses.sizeClasses.map((sc) => {
      const item = new vscode.CompletionItem(sc, vscode.CompletionItemKind.Keyword);
      item.detail = "size class";
      item.insertText = new vscode.SnippetString(`${sc}": {\n\t\${0}\n}`);
      return item;
    });
  }

  if (path.length === idx + 2 && typeof path[idx + 1] === "string") {
    const componentName = context.enclosingComponent ? resolveComponentName(services.attributes, context.enclosingComponent) : undefined;
    const attrs = attributesFor(services.attributes, componentName);
    const items: vscode.CompletionItem[] = [];
    for (const [name, spec] of Object.entries(attrs)) {
      if (name === "type" || name === "child" || name === "children" || name === "data" || name === "responsive" || name === "platform" || name === "platforms") continue;
      items.push(toCompletionItem(name, spec));
      const snippet = new vscode.CompletionItem(`${name}  (with value)`, vscode.CompletionItemKind.Snippet);
      snippet.filterText = name;
      snippet.sortText = `1_${name}`;
      snippet.insertText = new vscode.SnippetString(buildPropertySnippet(name, spec));
      items.push(snippet);
    }
    return items;
  }
  return [];
}
