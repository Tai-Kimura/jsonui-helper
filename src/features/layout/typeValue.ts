import * as vscode from "vscode";
import type { CursorContext } from "../../ast/cursor";
import type { ExtensionServices } from "../../services";

const CONTAINER_COMPONENTS = new Set([
  "View", "SafeAreaView", "ScrollView", "Scroll", "Collection", "Table",
  "GradientView", "Blur", "CircleView", "TabView",
]);

const SIMPLE_WIDTH_HEIGHT = `"width": "\${1|matchParent,wrapContent|}", "height": "\${2|matchParent,wrapContent|}"`;

function componentSnippet(name: string): string {
  if (CONTAINER_COMPONENTS.has(name)) {
    return `"${name}",\n\t${SIMPLE_WIDTH_HEIGHT},\n\t"child": [\n\t\t\${0}\n\t]`;
  }
  if (name === "Label") {
    return `"Label",\n\t"width": "\${1|wrapContent,matchParent|}", "height": "\${2|wrapContent,matchParent|}",\n\t"text": "\${3:Hello}"`;
  }
  if (name === "Button") {
    return `"Button",\n\t${SIMPLE_WIDTH_HEIGHT},\n\t"text": "\${3:Click}",\n\t"onClick": "@{\${4:handler}}"`;
  }
  if (name === "TextField") {
    return `"TextField",\n\t${SIMPLE_WIDTH_HEIGHT},\n\t"hint": "\${3:Enter}",\n\t"text": "@{\${4:value}}"`;
  }
  if (name === "Image" || name === "NetworkImage" || name === "CircleImage") {
    const srcKey = name === "Image" ? "src" : "url";
    return `"${name}",\n\t${SIMPLE_WIDTH_HEIGHT},\n\t"${srcKey}": "\${3:}"`;
  }
  return `"${name}",\n\t${SIMPLE_WIDTH_HEIGHT}`;
}

export function provideLayoutTypeValues(context: CursorContext, services: ExtensionServices): vscode.CompletionItem[] {
  if (context.parentProperty !== "type") return [];
  // Only in value position of a property named "type".
  if (context.positionKind !== "propertyValue" && context.positionKind !== "stringContent" && context.positionKind !== "emptyObject") {
    return [];
  }

  const items: vscode.CompletionItem[] = [];
  // `stringContent` = inside existing quotes, so emit the inner payload only.
  const insideQuotes = context.positionKind === "stringContent";

  for (const name of services.attributes.componentNames.sort()) {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
    const snippet = componentSnippet(name);
    const body = insideQuotes ? snippet.replace(/^"[^"]*"/, name) : snippet;
    item.insertText = new vscode.SnippetString(body);
    item.detail = "JsonUI component";
    item.sortText = `0_${name}`;
    items.push(item);

    // Simple variant without the width/height/child bulk: just the bare name.
    const simple = new vscode.CompletionItem(`${name}  (bare)`, vscode.CompletionItemKind.EnumMember);
    simple.filterText = name;
    simple.sortText = `1_${name}`;
    simple.insertText = insideQuotes ? name : `"${name}"`;
    items.push(simple);
  }
  return items;
}
