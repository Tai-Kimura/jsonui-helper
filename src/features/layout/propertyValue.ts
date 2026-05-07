import * as vscode from "vscode";
import { bindingPrefix, currentStringPrefix, isInsideBindingExpression, type CursorContext } from "../../ast/cursor";
import { dataNames, siblingIds } from "../../ast/collect";
import { attributesFor, resolveComponentName, type AttributeSpec } from "../../vendor/attributes";
import type { ExtensionServices } from "../../services";

const ALIGN_VIEW_ATTRS = new Set([
  "alignTopOfView", "alignBottomOfView", "alignLeftOfView", "alignRightOfView",
  "alignTopView", "alignBottomView", "alignLeftView", "alignRightView",
  "alignCenterVerticalView", "alignCenterHorizontalView",
]);

const COLOR_ATTRS_HINT = new Set([
  "fontColor", "background", "borderColor", "tapBackground", "tint", "tintColor",
  "color", "highlightColor", "hintColor", "hilightColor", "disabledFontColor",
  "disabledBackground", "normalColor", "selectedColor", "selectedFontColor",
  "accessoryBackground", "accessoryTextColor", "highlightBackground", "shadowColor",
]);

function enumFromSpec(spec: AttributeSpec): string[] | undefined {
  if (spec.enum && spec.enum.length > 0) return spec.enum;
  for (const t of spec.types) {
    if (typeof t === "object" && "enum" in t) return t.enum;
  }
  return undefined;
}

function completionFor(value: string, detail?: string, kind: vscode.CompletionItemKind = vscode.CompletionItemKind.EnumMember): vscode.CompletionItem {
  const item = new vscode.CompletionItem(value, kind);
  if (detail) item.detail = detail;
  item.insertText = value;
  item.filterText = value;
  return item;
}

function bindingCompletion(context: CursorContext): vscode.CompletionItem[] {
  if (!isInsideBindingExpression(context)) return [];
  const prefix = bindingPrefix(context) ?? "";
  const names = dataNames(context.document);
  return names
    .filter((n) => n.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((n) => {
      const item = new vscode.CompletionItem(n, vscode.CompletionItemKind.Variable);
      item.detail = "data binding";
      item.insertText = n;
      return item;
    });
}

function widthHeightCompletion(): vscode.CompletionItem[] {
  return ["matchParent", "wrapContent"].map((v) => completionFor(v, "dimension"));
}

function alignIdCompletion(context: CursorContext): vscode.CompletionItem[] {
  const ids = siblingIds(context.document, context.jsonPath);
  return ids.map((id) => completionFor(id, "sibling id", vscode.CompletionItemKind.Reference));
}

function colorCompletion(services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  const idx = services.indexesFor(uri);
  if (!idx) return [];
  return idx.colors.entries.map((c) => {
    const item = new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Color);
    item.detail = `${c.hex ?? "(color)"} (${c.source}.json)`;
    item.insertText = c.name;
    item.sortText = c.source === "colors" ? `0_${c.name}` : `1_${c.name}`;
    return item;
  });
}

function stringResourceCompletion(services: ExtensionServices, uri: vscode.Uri, prefix: string): vscode.CompletionItem[] {
  const idx = services.indexesFor(uri);
  if (!idx) return [];
  const items: vscode.CompletionItem[] = [];
  for (const [key, value] of idx.strings.flat.entries()) {
    if (!key.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Value);
    item.detail = `"${value}"`;
    item.insertText = key;
    items.push(item);
  }
  return items;
}

function imageCompletion(services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  const idx = services.indexesFor(uri);
  if (!idx) return [];
  return idx.images.names.map((n) => completionFor(n, "svg image", vscode.CompletionItemKind.File));
}

function layoutRefCompletion(services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  const idx = services.indexesFor(uri);
  if (!idx) return [];
  return idx.layouts.entries.map((p) => completionFor(p, "layout", vscode.CompletionItemKind.File));
}

function styleRefCompletion(services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  const idx = services.indexesFor(uri);
  if (!idx) return [];
  return idx.styles.names.map((n) => completionFor(n, "style", vscode.CompletionItemKind.File));
}

/** Main entry point for the Layout JSON property-value completion provider. */
export function provideLayoutPropertyValue(context: CursorContext, services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  // 1. Data-binding expression inside a string.
  if (context.positionKind === "stringContent") {
    const binding = bindingCompletion(context);
    if (binding.length > 0) return binding;
  }

  const prop = context.parentProperty;
  if (!prop) return [];

  // 2. Special paths.
  if (prop === "width" || prop === "height" || prop === "minWidth" || prop === "maxWidth" || prop === "minHeight" || prop === "maxHeight") {
    return widthHeightCompletion();
  }
  if (ALIGN_VIEW_ATTRS.has(prop)) {
    return alignIdCompletion(context);
  }
  if (COLOR_ATTRS_HINT.has(prop)) {
    return colorCompletion(services, uri);
  }
  if (prop === "text" || prop === "hint" || prop === "placeholder") {
    const prefix = currentStringPrefix(context) ?? "";
    return stringResourceCompletion(services, uri, prefix);
  }
  if (prop === "style") {
    return styleRefCompletion(services, uri);
  }
  if (prop === "include" || prop === "view") {
    return layoutRefCompletion(services, uri);
  }
  if (prop === "cell" || prop === "header" || prop === "footer") {
    // Inside sections[] objects.
    return layoutRefCompletion(services, uri);
  }
  if (prop === "src") {
    return imageCompletion(services, uri);
  }

  // 3. cellClasses is an array of strings; each element is a layout ref.
  const last = context.jsonPath[context.jsonPath.length - 1];
  if (typeof last === "number") {
    const parentProp = context.jsonPath[context.jsonPath.length - 2];
    if (parentProp === "cellClasses") {
      return layoutRefCompletion(services, uri);
    }
  }

  // 4. Fall back to enum-driven completion from the attribute catalog.
  const componentName = context.enclosingComponent ? resolveComponentName(services.attributes, context.enclosingComponent) : undefined;
  const attrs = attributesFor(services.attributes, componentName);
  const spec = attrs[prop];
  if (spec) {
    const enums = enumFromSpec(spec);
    if (enums && enums.length > 0) {
      return enums.map((v) => completionFor(v, spec.description));
    }
  }
  return [];
}
