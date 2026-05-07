import { concreteTypeNames, genericPatterns, mergeProjectTypeMap, type TypeMapSnapshot } from "../vendor/typeMap";

export interface TypeNameCatalog {
  snapshot: TypeMapSnapshot;
  concrete: string[];
  patterns: string[];
}

export function buildTypeNameCatalog(extensionRoot: string, projectFile: string | undefined): TypeNameCatalog {
  const snapshot = mergeProjectTypeMap(extensionRoot, projectFile);
  return {
    snapshot,
    concrete: concreteTypeNames(snapshot).sort(),
    patterns: genericPatterns(snapshot).sort((a, b) => b.length - a.length),
  };
}

const IOS_ONLY_TOKENS = ["UIImage", "CGImage", "UIView", "UIColor", "UIFont", "CGRect", "CGSize", "CGPoint"];

export function iosOnlyTokensFound(typeExpr: string): string[] {
  const found: string[] = [];
  for (const token of IOS_ONLY_TOKENS) {
    if (typeExpr.includes(token)) found.push(token);
  }
  if (/\binout\s+\w/.test(typeExpr)) found.push("inout");
  // Labelled tuple: `(name: Type, other: Type)`.
  if (/\(\s*\w+\s*:/.test(typeExpr)) found.push("labelled tuple");
  return found;
}
