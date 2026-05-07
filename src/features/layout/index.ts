import * as vscode from "vscode";
import type { DocumentKind } from "../../config/documentKind";
import type { ExtensionServices } from "../../services";
import { buildCursorContext } from "../../ast/cursor";
import { provideLayoutData } from "./data";
import { providePartialAttributes } from "./partialAttributes";
import { providePlatformOverride, providePlatformsArray } from "./platformOverride";
import { provideLayoutPropertyNames } from "./propertyName";
import { provideLayoutPropertyValue } from "./propertyValue";
import { provideLayoutTypeValues } from "./typeValue";
import { provideResponsive } from "./responsive";

const APPLIES_TO: DocumentKind[] = ["layout", "style", "unknown"];

export class LayoutCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly services: ExtensionServices) {}

  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const detection = this.services.detect(document);
    if (!APPLIES_TO.includes(detection.kind)) return [];
    const offset = document.offsetAt(position);
    const context = buildCursorContext(document.getText(), offset, detection.kind);

    // 1. Nested scopes first (platform override, responsive override, partialAttributes).
    const platformOverride = providePlatformOverride(context, this.services);
    if (platformOverride.length > 0) return platformOverride;

    const responsive = provideResponsive(context, this.services);
    if (responsive.length > 0) return responsive;

    const partial = providePartialAttributes(context);
    if (partial.length > 0) return partial;

    // 2. data[] scope.
    const data = provideLayoutData(context, this.services, document.uri);
    if (data.length > 0) return data;

    // 3. platforms array.
    const platformsArr = providePlatformsArray(context);
    if (platformsArr.length > 0) return platformsArr;

    // 4. "type" value completion (runs before generic value completion so component names win).
    if (context.parentProperty === "type") {
      return provideLayoutTypeValues(context, this.services);
    }

    // 5. Generic property-name vs. property-value dispatch.
    if (context.positionKind === "propertyName") {
      return provideLayoutPropertyNames(context, this.services);
    }
    return provideLayoutPropertyValue(context, this.services, document.uri);
  }
}
