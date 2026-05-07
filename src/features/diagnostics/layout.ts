import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";
import { parseWithErrors } from "../../ast/index";
import type { ExtensionServices } from "../../services";
import { attributesFor, resolveComponentName, type AttributeSpec } from "../../vendor/attributes";
import { resolveLayoutRef } from "../../resolve/layoutRef";
import { resolveStyleRef } from "../../resolve/styleRef";

function rangeFromNode(doc: vscode.TextDocument, node: jsonc.Node): vscode.Range {
  return new vscode.Range(doc.positionAt(node.offset), doc.positionAt(node.offset + node.length));
}

function enumValues(spec: AttributeSpec): string[] | undefined {
  if (spec.enum && spec.enum.length > 0) return spec.enum;
  for (const t of spec.types) {
    if (typeof t === "object" && "enum" in t) return t.enum;
  }
  return undefined;
}

function isAttributeKnown(spec: AttributeSpec, value: unknown): boolean {
  const enums = enumValues(spec);
  if (enums && typeof value === "string") {
    return enums.includes(value);
  }
  return true; // Type checking is left to the user / runtime.
}

export function diagnoseLayout(document: vscode.TextDocument, services: ExtensionServices): vscode.Diagnostic[] {
  const { tree, errors } = parseWithErrors(document.getText());
  const diagnostics: vscode.Diagnostic[] = [];
  const config = services.configFor(document.uri);
  const idx = services.indexesFor(document.uri);

  for (const err of errors) {
    const range = new vscode.Range(document.positionAt(err.offset), document.positionAt(err.offset + err.length));
    diagnostics.push(new vscode.Diagnostic(range, `JSON parse error (${err.error})`, vscode.DiagnosticSeverity.Error));
  }
  if (!tree) return diagnostics;

  const idRegistry = new Map<string, jsonc.Node[]>();

  const inspectComponent = (node: jsonc.Node, _pathParent: jsonc.Node | undefined, isRoot: boolean) => {
    if (node.type !== "object") return;
    let typeValue: string | undefined;
    let hasVisibility = false;
    let hasHidden = false;
    for (const prop of node.children ?? []) {
      const keyNode = prop.children?.[0];
      const valueNode = prop.children?.[1];
      if (!keyNode) continue;
      const keyName = String(keyNode.value);
      if (keyName === "type" && valueNode?.type === "string") typeValue = String(valueNode.value);
      if (keyName === "visibility") hasVisibility = true;
      if (keyName === "hidden") hasHidden = true;
    }

    const componentName = typeValue ? resolveComponentName(services.attributes, typeValue) : undefined;
    const attrs = typeValue ? attributesFor(services.attributes, componentName) : services.attributes.common;

    for (const prop of node.children ?? []) {
      const keyNode = prop.children?.[0];
      const valueNode = prop.children?.[1];
      if (!keyNode) continue;
      const keyName = String(keyNode.value);

      // Skip framework-level structural keys.
      if (keyName === "child" || keyName === "children" || keyName === "platform" || keyName === "responsive" || keyName === "platforms" || keyName === "data" || keyName === "include" || keyName === "events" || keyName === "variables" || keyName === "shared_data") continue;

      const spec = attrs[keyName];
      if (!spec && typeValue) {
        // Skip keys allowed on spec documents that shouldn't trigger on layouts: description, purpose…
        // Otherwise report as unknown.
        diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, keyNode), `Unknown attribute "${keyName}" on ${typeValue}`, vscode.DiagnosticSeverity.Warning));
      } else if (spec) {
        // Enum check on string values.
        if (valueNode?.type === "string") {
          const val = String(valueNode.value);
          if (!isAttributeKnown(spec, val)) {
            const enums = enumValues(spec);
            if (enums) diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, valueNode), `"${val}" is not a valid value for ${keyName}. Allowed: ${enums.join(", ")}`, vscode.DiagnosticSeverity.Error));
          }
        }
      }

      // id collection.
      if (keyName === "id" && valueNode?.type === "string") {
        const id = String(valueNode.value);
        const list = idRegistry.get(id) ?? [];
        list.push(valueNode);
        idRegistry.set(id, list);
      }

      // platforms array: root-only.
      if (keyName === "platforms" && !isRoot) {
        diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, keyNode), '"platforms" is only valid at the root of a layout file.', vscode.DiagnosticSeverity.Error));
      }

      // platform object: only ios/android/web keys.
      if (keyName === "platform" && valueNode?.type === "object") {
        for (const sub of valueNode.children ?? []) {
          const subKeyNode = sub.children?.[0];
          const subKey = subKeyNode?.value;
          if (subKey !== "ios" && subKey !== "android" && subKey !== "web") {
            diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, subKeyNode ?? sub), `Unknown platform key "${subKey}". Allowed: ios, android, web.`, vscode.DiagnosticSeverity.Error));
          }
        }
      }

      // responsive object: size-class keys.
      if (keyName === "responsive" && valueNode?.type === "object") {
        const allowed = new Set(services.sizeClasses.sizeClasses);
        for (const sub of valueNode.children ?? []) {
          const subKeyNode = sub.children?.[0];
          const subKey = String(subKeyNode?.value ?? "");
          if (!allowed.has(subKey)) {
            diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, subKeyNode ?? sub), `Unknown size class "${subKey}". Allowed: ${[...allowed].join(", ")}.`, vscode.DiagnosticSeverity.Error));
          }
        }
      }

      // Unresolved references.
      if (keyName === "include" || keyName === "view") {
        if (valueNode?.type === "string" && config) {
          const v = String(valueNode.value);
          if (!resolveLayoutRef(config.layoutsDirectory, v)) {
            diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, valueNode), `Unresolved layout reference "${v}".`, vscode.DiagnosticSeverity.Error));
          }
        }
      }
      if (keyName === "style" && valueNode?.type === "string" && idx) {
        if (!resolveStyleRef(idx.styles, String(valueNode.value))) {
          diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, valueNode), `Unresolved style "${String(valueNode.value)}".`, vscode.DiagnosticSeverity.Error));
        }
      }
      if (keyName === "cellClasses" && valueNode?.type === "array" && config) {
        for (const el of valueNode.children ?? []) {
          if (el.type !== "string") continue;
          if (!resolveLayoutRef(config.layoutsDirectory, String(el.value))) {
            diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, el), `Unresolved cellClasses entry "${String(el.value)}".`, vscode.DiagnosticSeverity.Error));
          }
        }
      }
      if ((keyName === "cell" || keyName === "header" || keyName === "footer") && valueNode?.type === "string" && config) {
        if (!resolveLayoutRef(config.layoutsDirectory, String(valueNode.value))) {
          diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, valueNode), `Unresolved ${keyName} reference "${String(valueNode.value)}".`, vscode.DiagnosticSeverity.Error));
        }
      }

      // Recurse into object / array children.
      if (valueNode?.type === "object") inspectComponent(valueNode, node, false);
      if (valueNode?.type === "array") {
        for (const el of valueNode.children ?? []) {
          if (el.type === "object") inspectComponent(el, node, false);
        }
      }
    }

    if (hasHidden && hasVisibility) {
      const key = node.children?.find((c) => c.children?.[0]?.value === "visibility")?.children?.[0];
      if (key) diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, key), "Both `hidden` and `visibility` are specified on the same component.", vscode.DiagnosticSeverity.Warning));
    }
  };

  if (tree.type === "object") inspectComponent(tree, undefined, true);
  else if (tree.type === "array") {
    for (const el of tree.children ?? []) inspectComponent(el, undefined, true);
  }

  for (const [id, occurrences] of idRegistry) {
    if (occurrences.length > 1) {
      for (const occ of occurrences) {
        diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, occ), `Duplicate id "${id}" (${occurrences.length} occurrences).`, vscode.DiagnosticSeverity.Warning));
      }
    }
  }

  return diagnostics;
}
