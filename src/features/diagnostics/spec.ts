import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";
import { parseWithErrors } from "../../ast/index";
import { findAtLocation, getValue, propertyValue } from "../../ast/index";
import type { ExtensionServices } from "../../services";
import { specComponentIds, repositoryNames } from "../../ast/collect";
import { resolveLayoutRef } from "../../resolve/layoutRef";
import { resolveSpecRef } from "../../resolve/specRef";
import { iosOnlyTokensFound } from "../../resolve/typeNames";

function rangeFromNode(doc: vscode.TextDocument, node: jsonc.Node): vscode.Range {
  return new vscode.Range(doc.positionAt(node.offset), doc.positionAt(node.offset + node.length));
}

export function diagnoseSpec(document: vscode.TextDocument, services: ExtensionServices): vscode.Diagnostic[] {
  const { tree, errors } = parseWithErrors(document.getText());
  const diagnostics: vscode.Diagnostic[] = [];
  const config = services.configFor(document.uri);
  for (const err of errors) {
    diagnostics.push(new vscode.Diagnostic(new vscode.Range(document.positionAt(err.offset), document.positionAt(err.offset + err.length)), `JSON parse error (${err.error})`, vscode.DiagnosticSeverity.Error));
  }
  if (!tree || !config) return diagnostics;

  // layoutFile reference.
  const layoutFileNode = findAtLocation({ text: document.getText(), tree }, ["metadata", "layoutFile"]);
  if (layoutFileNode?.type === "string") {
    const val = String(layoutFileNode.value);
    if (val && !resolveLayoutRef(config.layoutsDirectory, val)) {
      diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, layoutFileNode), `Unresolved metadata.layoutFile "${val}".`, vscode.DiagnosticSeverity.Error));
    }
  }

  // subSpecs[].file references.
  const subSpecsNode = findAtLocation({ text: document.getText(), tree }, ["subSpecs"]);
  if (subSpecsNode?.type === "array") {
    for (const entry of subSpecsNode.children ?? []) {
      if (entry.type !== "object") continue;
      const file = propertyValue(entry, "file");
      if (file?.type === "string") {
        const v = String(file.value);
        if (!resolveSpecRef(config.specDirectory, v)) {
          diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, file), `Unresolved subSpecs.file "${v}".`, vscode.DiagnosticSeverity.Error));
        }
      }
    }
  }

  // structure.customComponents[].specFile.
  const customComponentsNode = findAtLocation({ text: document.getText(), tree }, ["structure", "customComponents"]);
  if (customComponentsNode?.type === "array") {
    for (const entry of customComponentsNode.children ?? []) {
      if (entry.type !== "object") continue;
      const file = propertyValue(entry, "specFile");
      if (file?.type === "string") {
        const v = String(file.value);
        if (!resolveSpecRef(config.specDirectory, v)) {
          diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, file), `Unresolved customComponents.specFile "${v}".`, vscode.DiagnosticSeverity.Error));
        }
      }
    }
  }

  // Duplicate component ids in structure.components (recursive via children).
  const ids = specComponentIds({ text: document.getText(), tree });
  const seen = new Map<string, number>();
  for (const id of ids) {
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  if (ids.length > 0) {
    const components = findAtLocation({ text: document.getText(), tree }, ["structure", "components"]);
    const walk = (arrNode: jsonc.Node | undefined) => {
      if (arrNode?.type !== "array") return;
      for (const c of arrNode.children ?? []) {
        if (c.type !== "object") continue;
        const idNode = propertyValue(c, "id");
        if (idNode?.type === "string" && (seen.get(String(idNode.value)) ?? 0) > 1) {
          diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, idNode), `Duplicate component id "${String(idNode.value)}".`, vscode.DiagnosticSeverity.Warning));
        }
        walk(propertyValue(c, "children"));
      }
    };
    walk(components);
  }

  // displayLogic.effects[].element validity.
  const rules = findAtLocation({ text: document.getText(), tree }, ["stateManagement", "displayLogic"]);
  if (rules?.type === "array" && ids.length > 0) {
    const valid = new Set(ids);
    for (const rule of rules.children ?? []) {
      if (rule.type !== "object") continue;
      const effects = propertyValue(rule, "effects");
      if (effects?.type !== "array") continue;
      for (const eff of effects.children ?? []) {
        if (eff.type !== "object") continue;
        const el = propertyValue(eff, "element");
        if (el?.type === "string" && !valid.has(String(el.value))) {
          diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, el), `displayLogic.effects references unknown component id "${String(el.value)}".`, vscode.DiagnosticSeverity.Error));
        }
      }
    }
  }

  // useCases[].repositories must exist in dataFlow.repositories[].name.
  const useCasesNode = findAtLocation({ text: document.getText(), tree }, ["dataFlow", "useCases"]);
  if (useCasesNode?.type === "array") {
    const repos = new Set(repositoryNames({ text: document.getText(), tree }));
    for (const uc of useCasesNode.children ?? []) {
      if (uc.type !== "object") continue;
      const reposProp = propertyValue(uc, "repositories");
      if (reposProp?.type !== "array") continue;
      for (const r of reposProp.children ?? []) {
        if (r.type !== "string") continue;
        const name = String(r.value);
        if (!repos.has(name)) {
          diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, r), `UseCase references unknown Repository "${name}".`, vscode.DiagnosticSeverity.Error));
        }
      }
    }
  }

  // iOS-only tokens in returnType / params[].type without platforms:["ios"].
  const dataFlowNode = findAtLocation({ text: document.getText(), tree }, ["dataFlow"]);
  if (dataFlowNode?.type === "object") {
    for (const section of dataFlowNode.children ?? []) {
      const list = section.children?.[1];
      if (list?.type !== "array") continue;
      for (const owner of list.children ?? []) {
        if (owner.type !== "object") continue;
        const methods = propertyValue(owner, "methods");
        if (methods?.type !== "array") continue;
        for (const m of methods.children ?? []) {
          if (m.type !== "object") continue;
          const platformsNode = propertyValue(m, "platforms");
          const platformValues = platformsNode?.type === "array" ? (platformsNode.children ?? []).map((c) => getValue(c)) : undefined;
          const isIosOnly = Array.isArray(platformValues) && platformValues.length === 1 && platformValues[0] === "ios";

          const flag = (node: jsonc.Node | undefined) => {
            if (node?.type !== "string") return;
            const tokens = iosOnlyTokensFound(String(node.value));
            if (tokens.length > 0 && !isIosOnly) {
              diagnostics.push(new vscode.Diagnostic(rangeFromNode(document, node), `iOS-specific construct (${tokens.join(", ")}) used without platforms: ["ios"].`, vscode.DiagnosticSeverity.Warning));
            }
          };
          flag(propertyValue(m, "returnType"));
          const params = propertyValue(m, "params");
          if (params?.type === "array") {
            for (const p of params.children ?? []) {
              if (p.type !== "object") continue;
              flag(propertyValue(p, "type"));
            }
          }
        }
      }
    }
  }

  return diagnostics;
}
