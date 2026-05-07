import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";
import { buildCursorContext } from "../ast/cursor";
import { findAtLocation, getValue, objectProperties, propertyValue } from "../ast/index";
import type { ExtensionServices } from "../services";
import { resolveLayoutRef } from "../resolve/layoutRef";
import { resolveSpecRef } from "../resolve/specRef";
import { resolveStyleRef } from "../resolve/styleRef";

function locationFor(uri: vscode.Uri, range = new vscode.Range(0, 0, 0, 0)): vscode.Location {
  return new vscode.Location(uri, range);
}

function offsetRange(doc: vscode.TextDocument, offset: number, length: number): vscode.Range {
  const start = doc.positionAt(offset);
  const end = doc.positionAt(offset + length);
  return new vscode.Range(start, end);
}

export class JsonUIDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly services: ExtensionServices) {}

  provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Definition | undefined {
    const detection = this.services.detect(document);
    const context = buildCursorContext(document.getText(), document.offsetAt(position), detection.kind);
    const config = this.services.configFor(document.uri);
    const idx = this.services.indexesFor(document.uri);
    if (!config || !idx) return undefined;

    const prop = context.parentProperty;
    if (!prop || !context.stringNode) return undefined;

    // The string value without surrounding quotes.
    const value = (getValue(context.stringNode) as string) ?? "";

    // --- Layout references ------------------------------------------------
    if (prop === "include" || prop === "view" || prop === "cell" || prop === "header" || prop === "footer") {
      const abs = resolveLayoutRef(config.layoutsDirectory, value);
      if (abs) return locationFor(vscode.Uri.file(abs));
    }
    if (prop === "layoutFile") {
      const abs = resolveLayoutRef(config.layoutsDirectory, value);
      if (abs) return locationFor(vscode.Uri.file(abs));
    }
    if (prop === "style") {
      const abs = resolveStyleRef(idx.styles, value);
      if (abs) return locationFor(vscode.Uri.file(abs));
    }
    // cellClasses[] is an array of strings.
    const last = context.jsonPath[context.jsonPath.length - 1];
    if (typeof last === "number" && context.jsonPath[context.jsonPath.length - 2] === "cellClasses") {
      const abs = resolveLayoutRef(config.layoutsDirectory, value);
      if (abs) return locationFor(vscode.Uri.file(abs));
    }

    // --- Spec references --------------------------------------------------
    if (prop === "file" && context.jsonPath[context.jsonPath.length - 3] === "subSpecs") {
      const abs = resolveSpecRef(config.specDirectory, value);
      if (abs) return locationFor(vscode.Uri.file(abs));
    }
    if (prop === "specFile") {
      const abs = resolveSpecRef(config.specDirectory, value);
      if (abs) return locationFor(vscode.Uri.file(abs));
    }

    // --- Within-file references ------------------------------------------
    // displayLogic.effects[].element → structure.components[] where id matches.
    if (prop === "element" && context.jsonPath.includes("displayLogic")) {
      const target = findComponentById(context.document.tree, value);
      if (target) return locationFor(document.uri, offsetRange(document, target.offset, target.length));
    }
    // useCases[].repositories element → repositories[] with matching name.
    if (typeof last === "number" && context.jsonPath[context.jsonPath.length - 2] === "repositories" && context.jsonPath.includes("useCases")) {
      const repos = findAtLocation({ text: document.getText(), tree: context.document.tree }, ["dataFlow", "repositories"]);
      for (const entry of repos?.children ?? []) {
        if (entry.type !== "object") continue;
        const nameNode = propertyValue(entry, "name");
        if (getValue(nameNode) === value) {
          return locationFor(document.uri, offsetRange(document, entry.offset, entry.length));
        }
      }
    }
    // @{name} binding inside the current string → locate data[name=value].
    if (context.stringNode) {
      const literal = getValue(context.stringNode) as string;
      const offsetInString = document.offsetAt(position) - (context.stringNode.offset + 1);
      const before = literal.slice(0, offsetInString);
      const atIdx = before.lastIndexOf("@{");
      if (atIdx !== -1) {
        const endIdx = literal.indexOf("}", atIdx);
        if (endIdx !== -1 && endIdx >= offsetInString) {
          const name = literal.slice(atIdx + 2, endIdx);
          const dataArray = findAtLocation({ text: document.getText(), tree: context.document.tree }, ["data"]);
          for (const entry of dataArray?.children ?? []) {
            if (entry.type !== "object") continue;
            const nameNode = propertyValue(entry, "name");
            if (getValue(nameNode) === name) {
              return locationFor(document.uri, offsetRange(document, entry.offset, entry.length));
            }
          }
        }
      }
    }

    return undefined;
  }
}

function findComponentById(tree: jsonc.Node | undefined, id: string): jsonc.Node | undefined {
  if (!tree) return undefined;
  let result: jsonc.Node | undefined;
  const visit = (node: jsonc.Node) => {
    if (result) return;
    if (node.type === "object") {
      const idNode = objectProperties(node).find((p) => p.children?.[0]?.value === "id")?.children?.[1];
      if (idNode && getValue(idNode) === id) {
        result = node;
        return;
      }
      for (const p of node.children ?? []) {
        const value = p.children?.[1];
        if (value) visit(value);
      }
    } else if (node.type === "array") {
      for (const e of node.children ?? []) visit(e);
    }
  };
  visit(tree);
  return result;
}
