import * as vscode from "vscode";
import { detectDocumentKind, type DocumentKindDetection } from "./config/documentKind";
import { getConfigFor, type WorkspaceState } from "./config/workspace";
import { buildIndexes, type ProjectIndexes } from "./resolve/indexes";
import { loadAttributeCatalog, type AttributeCatalog } from "./vendor/attributes";
import { loadSizeClasses, type SizeClassInfo } from "./vendor/sizeClasses";
import { loadSpecSchemas, type SpecSchemas } from "./vendor/specSchema";
import type { JuiConfig } from "./config/juiConfig";

export class ExtensionServices {
  readonly extensionRoot: string;
  readonly state: WorkspaceState;
  readonly attributes: AttributeCatalog;
  readonly schemas: SpecSchemas;
  readonly sizeClasses: SizeClassInfo;

  constructor(extensionRoot: string, state: WorkspaceState) {
    this.extensionRoot = extensionRoot;
    this.state = state;
    this.attributes = loadAttributeCatalog(extensionRoot);
    this.schemas = loadSpecSchemas(extensionRoot);
    this.sizeClasses = loadSizeClasses(extensionRoot);
  }

  folderFor(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.getWorkspaceFolder(uri);
  }

  configFor(uri: vscode.Uri): JuiConfig | undefined {
    const folder = this.folderFor(uri);
    if (!folder) return undefined;
    return getConfigFor(this.state, folder);
  }

  indexesFor(uri: vscode.Uri): ProjectIndexes | undefined {
    const folder = this.folderFor(uri);
    if (!folder) return undefined;
    const key = folder.uri.toString();
    let idx = this.state.indexes.get(key);
    if (!idx) {
      const cfg = this.configFor(uri);
      if (!cfg) return undefined;
      idx = buildIndexes(this.extensionRoot, cfg);
      this.state.indexes.set(key, idx);
    }
    return idx;
  }

  detect(document: vscode.TextDocument): DocumentKindDetection {
    return detectDocumentKind(document.uri.fsPath, document.getText(), this.configFor(document.uri));
  }
}
