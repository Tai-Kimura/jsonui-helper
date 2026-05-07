import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface JuiConfig {
  /** Workspace folder this config resolves against. */
  workspaceRoot: string;
  /** Absolute path to the jui.config.json that was loaded, or undefined if only defaults. */
  configPath?: string;
  /** Absolute path (always resolved, even when jui.config.json is missing). */
  layoutsDirectory: string;
  specDirectory: string;
  stylesDirectory: string;
  stringsFile: string;
  imagesDirectory: string;
  /** Absolute path to the project-local type map if present. */
  typeMapFile?: string;
  /** Absolute path to the project-local rules file if present. */
  rulesFile?: string;
  /** Raw config object for future extensions. */
  raw?: Record<string, unknown>;
}

const DEFAULTS = {
  layoutsDirectory: "docs/screens/layouts",
  specDirectory: "docs/screens/json",
  stylesDirectory: "docs/screens/styles",
  stringsFile: "docs/screens/layouts/Resources/strings.json",
  imagesDirectory: "docs/screens/images",
} as const;

function readJson(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

function abs(root: string, relOrAbs: string): string {
  return path.isAbsolute(relOrAbs) ? relOrAbs : path.resolve(root, relOrAbs);
}

function pickString(settings: vscode.WorkspaceConfiguration, key: string): string | undefined {
  const v = settings.get<string>(key);
  return v && v.trim().length > 0 ? v : undefined;
}

export function loadJuiConfig(workspaceRoot: string): JuiConfig {
  const settings = vscode.workspace.getConfiguration("jsonuiHelper", vscode.Uri.file(workspaceRoot));
  const configFileName = settings.get<string>("configFile") || "jui.config.json";
  const configPath = path.resolve(workspaceRoot, configFileName);
  const raw = fs.existsSync(configPath) ? readJson(configPath) : undefined;

  const layoutsRel = pickString(settings, "layoutsDirectory") ?? (raw?.layouts_directory as string) ?? DEFAULTS.layoutsDirectory;
  const specRel = pickString(settings, "specDirectory") ?? (raw?.spec_directory as string) ?? DEFAULTS.specDirectory;
  const stylesRel = pickString(settings, "stylesDirectory") ?? (raw?.styles_directory as string) ?? DEFAULTS.stylesDirectory;
  const stringsRel = pickString(settings, "stringsFile") ?? (raw?.strings_file as string) ?? DEFAULTS.stringsFile;
  const imagesRel = (raw?.images_directory as string) ?? DEFAULTS.imagesDirectory;

  const typeMapPath = path.resolve(workspaceRoot, ".jsonui-type-map.json");
  const rulesPath = path.resolve(workspaceRoot, ".jsonui-doc-rules.json");

  return {
    workspaceRoot,
    configPath: raw ? configPath : undefined,
    layoutsDirectory: abs(workspaceRoot, layoutsRel),
    specDirectory: abs(workspaceRoot, specRel),
    stylesDirectory: abs(workspaceRoot, stylesRel),
    stringsFile: abs(workspaceRoot, stringsRel),
    imagesDirectory: abs(workspaceRoot, imagesRel),
    typeMapFile: fs.existsSync(typeMapPath) ? typeMapPath : undefined,
    rulesFile: fs.existsSync(rulesPath) ? rulesPath : undefined,
    raw,
  };
}

export function workspaceRootFor(uri: vscode.Uri): string | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  return folder?.uri.fsPath;
}
