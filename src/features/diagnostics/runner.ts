import * as vscode from "vscode";
import type { ExtensionServices } from "../../services";
import { diagnoseLayout } from "./layout";
import { diagnoseSpec } from "./spec";

export function registerDiagnostics(context: vscode.ExtensionContext, services: ExtensionServices): void {
  const collection = vscode.languages.createDiagnosticCollection("jsonui-helper");
  context.subscriptions.push(collection);

  const debounce = new Map<string, NodeJS.Timeout>();
  const run = (document: vscode.TextDocument) => {
    const enabled = vscode.workspace.getConfiguration("jsonuiHelper").get<boolean>("diagnostics.enabled", true);
    if (!enabled) {
      collection.set(document.uri, []);
      return;
    }
    const lang = document.languageId;
    if (lang !== "json" && lang !== "jsonc") {
      collection.delete(document.uri);
      return;
    }
    const detection = services.detect(document);
    try {
      if (detection.kind === "layout" || detection.kind === "style" || detection.kind === "unknown") {
        collection.set(document.uri, diagnoseLayout(document, services));
      } else if (detection.kind === "screenSpec" || detection.kind === "screenSubSpec" || detection.kind === "screenParentSpec" || detection.kind === "componentSpec") {
        collection.set(document.uri, diagnoseSpec(document, services));
      } else {
        collection.delete(document.uri);
      }
    } catch (err) {
      console.error("[jsonui-helper] diagnostics failed", err);
    }
  };

  const schedule = (document: vscode.TextDocument) => {
    const key = document.uri.toString();
    clearTimeout(debounce.get(key));
    debounce.set(key, setTimeout(() => run(document), 300));
  };

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(run));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((d) => collection.delete(d.uri)));
  for (const doc of vscode.workspace.textDocuments) run(doc);
}
