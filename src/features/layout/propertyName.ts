import * as vscode from "vscode";
import type { CursorContext } from "../../ast/cursor";
import type { ExtensionServices } from "../../services";
import { attributesFor, resolveComponentName } from "../../vendor/attributes";
import { buildPropertySnippet, toCompletionItem } from "../../vendor/valueSnippet";

/**
 * Provide property-name completion for Layout JSON. Requires the cursor to be at
 * a property-name position inside a component object. The component type is
 * resolved via `CursorContext.enclosingComponent`.
 */
export function provideLayoutPropertyNames(context: CursorContext, services: ExtensionServices): vscode.CompletionItem[] {
  if (context.positionKind !== "propertyName" && context.positionKind !== "stringContent") return [];
  // `stringContent` at a property-name position is handled by jsonc: we only
  // invoke when `positionKind === propertyName` to avoid duplicating.
  if (context.positionKind !== "propertyName") return [];

  const componentName = context.enclosingComponent ? resolveComponentName(services.attributes, context.enclosingComponent) : undefined;
  const attrs = attributesFor(services.attributes, componentName);

  const items: vscode.CompletionItem[] = [];
  for (const [name, spec] of Object.entries(attrs)) {
    // Name-only completion (covers the typical case of VSCode inserting a quoted key).
    const nameItem = toCompletionItem(name, spec);
    nameItem.insertText = name;
    items.push(nameItem);

    // Snippet variant with a default value.
    const snippet = new vscode.CompletionItem(`${name}  (with value)`, vscode.CompletionItemKind.Snippet);
    snippet.filterText = name;
    snippet.sortText = `1_${name}`;
    if (spec.description) snippet.documentation = new vscode.MarkdownString(spec.description);
    snippet.insertText = new vscode.SnippetString(buildPropertySnippet(name, spec));
    items.push(snippet);
  }
  return items;
}
