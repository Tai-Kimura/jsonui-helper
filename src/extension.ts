import * as vscode from "vscode";
import { createWorkspaceState, registerWorkspaceWatchers } from "./config/workspace";
import { ExtensionServices } from "./services";
import { LayoutCompletionProvider } from "./features/layout";
import { SpecCompletionProvider } from "./features/spec";
import { JsonUIHoverProvider } from "./features/hover";
import { JsonUIDefinitionProvider } from "./features/definition";
import { JsonUIDocumentLinkProvider } from "./features/documentLinks";
import { registerTemplateCommands } from "./commands/templates";
import { registerDiagnostics } from "./features/diagnostics/runner";

const JSON_SELECTOR: vscode.DocumentSelector = [
  { language: "json", scheme: "file" },
  { language: "jsonc", scheme: "file" },
];

const TRIGGER_CHARACTERS = ['"', ":", "@", "{", "/", "_"];

export function activate(context: vscode.ExtensionContext): void {
  const state = createWorkspaceState();
  const services = new ExtensionServices(context.extensionPath, state);

  registerWorkspaceWatchers(
    context,
    state,
    () => { /* config changed - indexes already invalidated */ },
    () => { /* indexes invalidated - next lookup rebuilds */ },
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(JSON_SELECTOR, new LayoutCompletionProvider(services), ...TRIGGER_CHARACTERS),
  );
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(JSON_SELECTOR, new SpecCompletionProvider(services), ...TRIGGER_CHARACTERS),
  );
  context.subscriptions.push(vscode.languages.registerHoverProvider(JSON_SELECTOR, new JsonUIHoverProvider(services)));
  context.subscriptions.push(vscode.languages.registerDefinitionProvider(JSON_SELECTOR, new JsonUIDefinitionProvider(services)));
  context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(JSON_SELECTOR, new JsonUIDocumentLinkProvider(services)));

  registerTemplateCommands(context);
  registerDiagnostics(context, services);
}

export function deactivate(): void {
  /* no-op */
}
