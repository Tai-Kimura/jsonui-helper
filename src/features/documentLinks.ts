import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";
import type { ExtensionServices } from "../services";
import { parseWithErrors } from "../ast/index";
import { resolveLayoutRef } from "../resolve/layoutRef";
import { resolveStyleRef } from "../resolve/styleRef";
import { resolveSpecRef } from "../resolve/specRef";

/** Walk the tree and yield every string node at the given `propertyName` location. */
function* walkStringsAt(tree: jsonc.Node | undefined, targetProperty: string): Generator<{ node: jsonc.Node; inArrayProperty?: string }> {
  if (!tree) return;
  const visit = function* (node: jsonc.Node, inArrayProperty?: string): Generator<{ node: jsonc.Node; inArrayProperty?: string }> {
    if (node.type === "object") {
      for (const prop of node.children ?? []) {
        const key = prop.children?.[0];
        const value = prop.children?.[1];
        if (!key || !value) continue;
        const keyName = String(key.value);
        if (keyName === targetProperty && value.type === "string") {
          yield { node: value, inArrayProperty };
        }
        if (value.type === "array") {
          for (const el of value.children ?? []) {
            if (keyName === targetProperty && el.type === "string") {
              yield { node: el, inArrayProperty };
            }
            yield* visit(el, keyName);
          }
        } else if (value.type === "object") {
          yield* visit(value, inArrayProperty);
        }
      }
    } else if (node.type === "array") {
      for (const el of node.children ?? []) yield* visit(el, inArrayProperty);
    }
  };
  yield* visit(tree);
}

function rangeOf(doc: vscode.TextDocument, node: jsonc.Node): vscode.Range {
  // Strip surrounding quotes.
  const start = doc.positionAt(node.offset + 1);
  const end = doc.positionAt(node.offset + node.length - 1);
  return new vscode.Range(start, end);
}

export class JsonUIDocumentLinkProvider implements vscode.DocumentLinkProvider {
  constructor(private readonly services: ExtensionServices) {}

  provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
    const detection = this.services.detect(document);
    const config = this.services.configFor(document.uri);
    const idx = this.services.indexesFor(document.uri);
    if (!config || !idx) return [];

    const { tree } = parseWithErrors(document.getText());
    const links: vscode.DocumentLink[] = [];
    const push = (value: string, target: string | undefined, range: vscode.Range) => {
      if (!target) return;
      const link = new vscode.DocumentLink(range, vscode.Uri.file(target));
      link.tooltip = value;
      links.push(link);
    };

    if (detection.kind === "layout" || detection.kind === "style" || detection.kind === "unknown") {
      for (const key of ["include", "view"]) {
        for (const hit of walkStringsAt(tree, key)) {
          const value = String(hit.node.value);
          push(value, resolveLayoutRef(config.layoutsDirectory, value), rangeOf(document, hit.node));
        }
      }
      for (const hit of walkStringsAt(tree, "cellClasses")) {
        // Here "value" is not a string property value but an array element.
        const value = String(hit.node.value);
        push(value, resolveLayoutRef(config.layoutsDirectory, value), rangeOf(document, hit.node));
      }
      for (const key of ["cell", "header", "footer"]) {
        for (const hit of walkStringsAt(tree, key)) {
          const value = String(hit.node.value);
          push(value, resolveLayoutRef(config.layoutsDirectory, value), rangeOf(document, hit.node));
        }
      }
      for (const hit of walkStringsAt(tree, "style")) {
        const value = String(hit.node.value);
        push(value, resolveStyleRef(idx.styles, value), rangeOf(document, hit.node));
      }
    }

    if (detection.kind.startsWith("screen") || detection.kind === "componentSpec") {
      for (const hit of walkStringsAt(tree, "layoutFile")) {
        const value = String(hit.node.value);
        push(value, resolveLayoutRef(config.layoutsDirectory, value), rangeOf(document, hit.node));
      }
      for (const hit of walkStringsAt(tree, "file")) {
        const value = String(hit.node.value);
        push(value, resolveSpecRef(config.specDirectory, value), rangeOf(document, hit.node));
      }
      for (const hit of walkStringsAt(tree, "specFile")) {
        const value = String(hit.node.value);
        push(value, resolveSpecRef(config.specDirectory, value), rangeOf(document, hit.node));
      }
    }

    return links;
  }
}
