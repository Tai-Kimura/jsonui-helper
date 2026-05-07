import * as vscode from "vscode";
import { loadJuiConfig, type JuiConfig } from "./juiConfig";
import type { ProjectIndexes } from "../resolve/indexes";

export interface WorkspaceState {
  /** Folder URI string → cached config. */
  configs: Map<string, JuiConfig>;
  /** Folder URI string → project-level indexes (layouts, styles, strings, …). */
  indexes: Map<string, ProjectIndexes>;
}

export function createWorkspaceState(): WorkspaceState {
  return { configs: new Map(), indexes: new Map() };
}

export function getConfigFor(state: WorkspaceState, folder: vscode.WorkspaceFolder): JuiConfig {
  const key = folder.uri.toString();
  let cfg = state.configs.get(key);
  if (!cfg) {
    cfg = loadJuiConfig(folder.uri.fsPath);
    state.configs.set(key, cfg);
  }
  return cfg;
}

export function invalidateConfig(state: WorkspaceState, folder: vscode.WorkspaceFolder): void {
  state.configs.delete(folder.uri.toString());
  state.indexes.delete(folder.uri.toString());
}

export function registerWorkspaceWatchers(
  context: vscode.ExtensionContext,
  state: WorkspaceState,
  onConfigChanged: (folder: vscode.WorkspaceFolder) => void,
  onIndexInvalidated: (folder: vscode.WorkspaceFolder) => void,
): void {
  // Config files: jui.config.json, .jsonui-type-map.json, .jsonui-doc-rules.json at workspace root.
  const configWatcher = vscode.workspace.createFileSystemWatcher(
    "**/{jui.config.json,.jsonui-type-map.json,.jsonui-doc-rules.json}",
  );
  const reloadForUri = (uri: vscode.Uri) => {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return;
    invalidateConfig(state, folder);
    onConfigChanged(folder);
    onIndexInvalidated(folder);
  };
  configWatcher.onDidCreate(reloadForUri);
  configWatcher.onDidChange(reloadForUri);
  configWatcher.onDidDelete(reloadForUri);
  context.subscriptions.push(configWatcher);

  // Any JSON under a workspace folder: invalidate the per-folder indexes.
  const jsonWatcher = vscode.workspace.createFileSystemWatcher("**/*.json");
  const invalidateForUri = (uri: vscode.Uri) => {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return;
    state.indexes.delete(folder.uri.toString());
    onIndexInvalidated(folder);
  };
  jsonWatcher.onDidCreate(invalidateForUri);
  jsonWatcher.onDidChange(invalidateForUri);
  jsonWatcher.onDidDelete(invalidateForUri);
  context.subscriptions.push(jsonWatcher);

  // SVGs for the images index.
  const svgWatcher = vscode.workspace.createFileSystemWatcher("**/*.svg");
  svgWatcher.onDidCreate(invalidateForUri);
  svgWatcher.onDidDelete(invalidateForUri);
  context.subscriptions.push(svgWatcher);

  // Settings changes that affect resolution.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("jsonuiHelper")) return;
      for (const folder of vscode.workspace.workspaceFolders ?? []) {
        invalidateConfig(state, folder);
        onConfigChanged(folder);
        onIndexInvalidated(folder);
      }
    }),
  );

  // Folder add/remove.
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      state.configs.clear();
      state.indexes.clear();
    }),
  );
}
