import * as path from "path";
import * as jsonc from "jsonc-parser";
import type { JuiConfig } from "./juiConfig";

export type DocumentKind =
  | "layout"
  | "style"
  | "strings"
  | "colors"
  | "definedColors"
  | "screenSpec"
  | "screenSubSpec"
  | "screenParentSpec"
  | "componentSpec"
  | "typeMap"
  | "rules"
  | "unknown";

export interface DocumentKindDetection {
  kind: DocumentKind;
  /** Root node value of "type" if the file declares one. */
  rootType?: string;
}

/** Is the absolute path inside (or equal to) the dir? */
function isInside(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isEqualPath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function isInsideOrEqual(file: string, dir: string): boolean {
  return isInside(file, dir) || isEqualPath(file, dir);
}

function rootTypeOf(text: string): string | undefined {
  try {
    const root = jsonc.parseTree(text);
    if (!root || root.type !== "object") return undefined;
    const typeNode = jsonc.findNodeAtLocation(root, ["type"]);
    if (!typeNode || typeNode.type !== "string") return undefined;
    return typeof typeNode.value === "string" ? typeNode.value : undefined;
  } catch {
    return undefined;
  }
}

export function detectDocumentKind(absPath: string, text: string, config?: JuiConfig | undefined): DocumentKindDetection {
  const base = path.basename(absPath);

  if (base === ".jsonui-type-map.json") return { kind: "typeMap" };
  if (base === ".jsonui-doc-rules.json") return { kind: "rules" };

  const rootType = rootTypeOf(text);

  if (base.endsWith(".spec.json") || rootType === "screen_spec" || rootType === "screen_sub_spec" || rootType === "screen_parent_spec" || rootType === "component_spec") {
    switch (rootType) {
      case "screen_sub_spec": return { kind: "screenSubSpec", rootType };
      case "screen_parent_spec": return { kind: "screenParentSpec", rootType };
      case "component_spec": return { kind: "componentSpec", rootType };
      case "screen_spec":
      default: return { kind: "screenSpec", rootType };
    }
  }

  if (config) {
    if (isEqualPath(absPath, config.stringsFile)) return { kind: "strings", rootType };

    // Colors (conventional filenames under Resources/).
    const layoutsResources = path.join(config.layoutsDirectory, "Resources");
    if (isInside(absPath, layoutsResources)) {
      if (base === "colors.json") return { kind: "colors", rootType };
      if (base === "defined_colors.json") return { kind: "definedColors", rootType };
    }

    // Styles directory lives either directly under layouts_directory/Styles (for shared-source layouts)
    // or in a dedicated styles_directory (as `jui build` distributes it).
    const layoutStyles = path.join(config.layoutsDirectory, "Styles");
    if (isInside(absPath, layoutStyles) || isInsideOrEqual(absPath, config.stylesDirectory)) {
      return { kind: "style", rootType };
    }

    if (isInside(absPath, config.layoutsDirectory) && absPath.endsWith(".json")) {
      return { kind: "layout", rootType };
    }
  }

  // Fallback: any JSON with a root "type" string looks like a layout.
  if (rootType) return { kind: "layout", rootType };

  return { kind: "unknown", rootType };
}
