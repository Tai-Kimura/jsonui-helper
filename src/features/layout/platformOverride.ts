import * as vscode from "vscode";
import type { CursorContext } from "../../ast/cursor";
import type { ExtensionServices } from "../../services";
import { attributesFor, resolveComponentName } from "../../vendor/attributes";
import { buildPropertySnippet, toCompletionItem } from "../../vendor/valueSnippet";

const PLATFORM_KEYS = ["ios", "android", "web"];

/**
 * `"platform": { "ios": { ... }, ... }` — scope-aware completion:
 *   - Keys `ios` / `android` / `web` inside the outer `platform` object.
 *   - Component attribute names inside a nested platform block.
 *
 * `"platforms": ["ios", ...]` at the root uses a separate provider.
 */
export function providePlatformOverride(context: CursorContext, services: ExtensionServices): vscode.CompletionItem[] {
  if (context.positionKind !== "propertyName") return [];
  const path = context.jsonPath;

  // Walk the path looking for a "platform" property followed by (optionally) the nested pf key.
  const idx = path.lastIndexOf("platform");
  if (idx === -1) return [];

  // Case A: cursor is at a key directly inside `platform` → suggest ios/android/web.
  if (path.length === idx + 1) {
    return PLATFORM_KEYS.map((k) => {
      const item = new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword);
      item.detail = "platform override";
      item.insertText = new vscode.SnippetString(`${k}": {\n\t\${0}\n}`);
      return item;
    });
  }

  // Case B: cursor is at a key inside `platform.<pf>` → behave like attribute-name completion.
  if (path.length === idx + 2 && typeof path[idx + 1] === "string" && PLATFORM_KEYS.includes(path[idx + 1] as string)) {
    const componentName = context.enclosingComponent ? resolveComponentName(services.attributes, context.enclosingComponent) : undefined;
    const attrs = attributesFor(services.attributes, componentName);
    const items: vscode.CompletionItem[] = [];
    for (const [name, spec] of Object.entries(attrs)) {
      // Skip structural keys that don't make sense in an override block.
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

/** `"platforms"` array: each element is "ios" / "android" / "web". */
export function providePlatformsArray(context: CursorContext): vscode.CompletionItem[] {
  // Must be an array element directly under "platforms".
  const parent = context.jsonPath[context.jsonPath.length - 2];
  if (parent !== "platforms") return [];
  return PLATFORM_KEYS.map((k) => {
    const item = new vscode.CompletionItem(k, vscode.CompletionItemKind.EnumMember);
    item.detail = "platform whitelist";
    item.insertText = k;
    return item;
  });
}
