import * as fs from "fs";
import * as path from "path";

export interface SizeClassInfo {
  sizeClasses: string[];
  priority: string[];
}

let cached: SizeClassInfo | null = null;

export function loadSizeClasses(extensionRoot: string): SizeClassInfo {
  if (cached) return cached;
  const file = path.join(extensionRoot, "vendor", "responsive_size_classes.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  cached = {
    sizeClasses: Array.isArray(raw?.size_classes) ? raw.size_classes : [],
    priority: Array.isArray(raw?.priority) ? raw.priority : [],
  };
  return cached;
}
