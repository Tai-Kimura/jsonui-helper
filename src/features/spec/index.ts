import * as vscode from "vscode";
import { buildCursorContext, type CursorContext } from "../../ast/cursor";
import { findAtLocation, getValue } from "../../ast/index";
import { repositoryNames, specComponentIds } from "../../ast/collect";
import type { DocumentKind } from "../../config/documentKind";
import type { ExtensionServices } from "../../services";
import { attributesFor, resolveComponentName } from "../../vendor/attributes";
import { buildPropertySnippet, toCompletionItem } from "../../vendor/valueSnippet";
import { provideSchemaEnumValues, provideSchemaPropertyNames } from "./schemaDriven";

const APPLIES_TO: DocumentKind[] = ["screenSpec", "screenSubSpec", "screenParentSpec", "componentSpec"];

const SPEC_TYPE_VALUES = [
  "screen_spec",
  "screen_sub_spec",
  "screen_parent_spec",
  "component_spec",
];

function specTypeValues(context: CursorContext): vscode.CompletionItem[] {
  // Root-level "type" property.
  if (context.parentProperty !== "type") return [];
  if (context.jsonPath.length !== 1) return [];
  return SPEC_TYPE_VALUES.map((v) => {
    const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember);
    item.insertText = v;
    item.sortText = v;
    return item;
  });
}

/** metadata.platforms and *.platforms (array of string, fixed enum). */
function platformsArray(context: CursorContext): vscode.CompletionItem[] {
  const last = context.jsonPath[context.jsonPath.length - 2];
  if (last !== "platforms") return [];
  return ["ios", "android", "web"].map((p) => {
    const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.EnumMember);
    item.insertText = p;
    return item;
  });
}

function layoutFileRef(context: CursorContext, services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  if (context.parentProperty !== "layoutFile") return [];
  const idx = services.indexesFor(uri);
  if (!idx) return [];
  return idx.layouts.entries.map((p) => {
    const item = new vscode.CompletionItem(p, vscode.CompletionItemKind.File);
    item.insertText = p;
    item.detail = "layout file";
    return item;
  });
}

function subSpecsFileRef(context: CursorContext, services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  if (context.parentProperty !== "file") return [];
  // Only when the parent path is "subSpecs".
  const beforeIdx = context.jsonPath.length - 3;
  if (context.jsonPath[beforeIdx] !== "subSpecs") return [];
  const idx = services.indexesFor(uri);
  if (!idx) return [];
  return idx.specs.all.map((e) => {
    const item = new vscode.CompletionItem(e.relative, vscode.CompletionItemKind.File);
    item.insertText = e.relative;
    item.detail = e.type ?? "spec";
    return item;
  });
}

function customComponentSpecFileRef(context: CursorContext, services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  if (context.parentProperty !== "specFile") return [];
  const idx = services.indexesFor(uri);
  if (!idx) return [];
  return idx.specs.componentSpecs.map((e) => {
    const item = new vscode.CompletionItem(e.relative, vscode.CompletionItemKind.File);
    item.insertText = e.relative;
    item.detail = "component_spec";
    return item;
  });
}

function componentIdChoice(context: CursorContext): vscode.CompletionItem[] {
  // Only applicable when parentProperty is "element" (displayLogic.effects[].element),
  // or the parent path ends with layout.root / layout.children[].id.
  const prop = context.parentProperty;
  const path = context.jsonPath;
  const tail2 = path.slice(-2);
  const isElement = prop === "element" && path.includes("displayLogic");
  const isLayoutRoot = prop === "root" && path.includes("layout");
  const isLayoutChildId = prop === "id" && tail2[0] === "children" && path.includes("layout");
  if (!isElement && !isLayoutRoot && !isLayoutChildId) return [];
  const ids = specComponentIds(context.document);
  return ids.map((id) => {
    const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Reference);
    item.insertText = id;
    item.detail = "component id";
    return item;
  });
}

function repositoryChoice(context: CursorContext): vscode.CompletionItem[] {
  const path = context.jsonPath;
  const ok = path.includes("useCases") && path[path.length - 2] === "repositories";
  if (!ok) return [];
  const names = repositoryNames(context.document);
  return names.map((n) => {
    const item = new vscode.CompletionItem(n, vscode.CompletionItemKind.Reference);
    item.insertText = n;
    item.detail = "Repository";
    return item;
  });
}

/** Custom component types that augment the built-in 28 in structure.components[].type. */
function componentTypeChoice(context: CursorContext, services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  if (context.parentProperty !== "type") return [];
  const path = context.jsonPath;
  // Only within structure.components[].type or structure.components[].children[].type etc.
  const inComponents = path.includes("components") && path.length >= 2;
  if (!inComponents) return [];
  const idx = services.indexesFor(uri);
  const names = new Set<string>(services.attributes.componentNames);
  if (idx) {
    for (const list of Object.values(idx.rules.componentTypes)) {
      for (const n of list) names.add(n);
    }
  }
  return [...names].sort().map((n) => {
    const item = new vscode.CompletionItem(n, vscode.CompletionItemKind.Class);
    item.insertText = n;
    return item;
  });
}

/** Type-name completion inside dataFlow.*.methods[*].params[*].type / returnType. */
function typeNameChoice(context: CursorContext, services: ExtensionServices, uri: vscode.Uri): vscode.CompletionItem[] {
  const prop = context.parentProperty;
  if (prop !== "type" && prop !== "returnType") return [];
  const path = context.jsonPath;
  if (!path.includes("dataFlow")) return [];
  const idx = services.indexesFor(uri);
  if (!idx) return [];
  const items: vscode.CompletionItem[] = [];
  for (const name of idx.typeNames.concrete) {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
    item.insertText = name;
    items.push(item);
  }
  for (const pattern of idx.typeNames.patterns) {
    const item = new vscode.CompletionItem(pattern, vscode.CompletionItemKind.TypeParameter);
    item.insertText = pattern;
    item.sortText = `1_${pattern}`;
    items.push(item);
  }
  return items;
}

/**
 * Inside structure.components[i].style — the property name position should
 * suggest the component's own attributes (not the schema generic "additionalProperties").
 */
function styleAttributeNames(context: CursorContext, services: ExtensionServices): vscode.CompletionItem[] {
  if (context.positionKind !== "propertyName") return [];
  const path = context.jsonPath;
  if (path[path.length - 1] !== undefined && path.includes("style")) {
    const styleIdx = path.lastIndexOf("style");
    if (styleIdx >= 0 && path.length - 1 > styleIdx) return [];
  }
  // Find the style object: parent property must be "style".
  const styleIdx = path.lastIndexOf("style");
  if (styleIdx === -1 || styleIdx !== path.length - 1) return [];
  // The component "type" is found by looking up the containing components[] element.
  let componentType: string | undefined;
  const componentsIdx = path.lastIndexOf("components");
  if (componentsIdx !== -1 && typeof path[componentsIdx + 1] === "number") {
    const componentNode = findAtLocation(context.document, path.slice(0, componentsIdx + 2));
    if (componentNode?.type === "object") {
      for (const child of componentNode.children ?? []) {
        if (child.children?.[0]?.value === "type") {
          componentType = getValue(child.children[1]) as string | undefined;
          break;
        }
      }
    }
  }
  const resolved = componentType ? resolveComponentName(services.attributes, componentType) : undefined;
  const attrs = attributesFor(services.attributes, resolved);
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

export class SpecCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly services: ExtensionServices) {}

  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const detection = this.services.detect(document);
    if (!APPLIES_TO.includes(detection.kind)) return [];

    const context = buildCursorContext(document.getText(), document.offsetAt(position), detection.kind);

    // Layered resolution: specific overrides first, then schema-driven generic.
    const ordered: (() => vscode.CompletionItem[])[] = [
      () => specTypeValues(context),
      () => platformsArray(context),
      () => layoutFileRef(context, this.services, document.uri),
      () => subSpecsFileRef(context, this.services, document.uri),
      () => customComponentSpecFileRef(context, this.services, document.uri),
      () => componentIdChoice(context),
      () => repositoryChoice(context),
      () => typeNameChoice(context, this.services, document.uri),
      () => componentTypeChoice(context, this.services, document.uri),
      () => styleAttributeNames(context, this.services),
    ];
    for (const step of ordered) {
      const out = step();
      if (out.length > 0) return out;
    }

    const schema = detection.kind === "componentSpec" ? this.services.schemas.componentSpec : this.services.schemas.screenSpec;
    if (context.positionKind === "propertyName") return provideSchemaPropertyNames(context, schema);
    return provideSchemaEnumValues(context, schema);
  }
}
