import * as vscode from "vscode";
import { buildCursorContext } from "../ast/cursor";
import { findAtLocation, getValue } from "../ast/index";
import type { ExtensionServices } from "../services";
import { attributesFor, resolveComponentName } from "../vendor/attributes";
import { dereference, resolveSchemaAtPath } from "../vendor/specSchema";

function mdCode(value: string): string {
  return "`" + value.replace(/`/g, "\\`") + "`";
}

export class JsonUIHoverProvider implements vscode.HoverProvider {
  constructor(private readonly services: ExtensionServices) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const detection = this.services.detect(document);
    const context = buildCursorContext(document.getText(), document.offsetAt(position), detection.kind);
    const path = context.jsonPath;
    if (path.length === 0) return undefined;

    // Layout hover on property names.
    if (detection.kind === "layout" || detection.kind === "style" || detection.kind === "unknown") {
      const name = typeof path[path.length - 1] === "string" ? (path[path.length - 1] as string) : undefined;
      if (name && context.node?.type === "string") {
        // Hover could be over either the key or the value — we only deliver when over the key.
        const keyProp = findAtLocation(context.document, path);
        if (keyProp && document.offsetAt(position) >= keyProp.offset && document.offsetAt(position) <= keyProp.offset + keyProp.length) {
          const componentName = context.enclosingComponent ? resolveComponentName(this.services.attributes, context.enclosingComponent) : undefined;
          const attrs = attributesFor(this.services.attributes, componentName);
          const spec = attrs[name];
          if (spec) {
            const md = new vscode.MarkdownString();
            if (spec.description) md.appendMarkdown(spec.description + "\n\n");
            const parts: string[] = [];
            if (spec.types.length > 0) parts.push(`type: ${spec.types.map((t) => (typeof t === "string" ? t : `enum(${t.enum.join("|")})`)).join(" | ")}`);
            if (spec.required) parts.push("required");
            if (spec.platform) parts.push(`platform: ${spec.platform}`);
            if (spec.mode) parts.push(`mode: ${spec.mode}`);
            if (parts.length > 0) md.appendMarkdown(parts.map(mdCode).join(" · "));
            return new vscode.Hover(md);
          }
        }
      }
    }

    // Spec hover: resolve the schema node, show its description.
    if (detection.kind === "screenSpec" || detection.kind === "screenSubSpec" || detection.kind === "screenParentSpec" || detection.kind === "componentSpec") {
      const schema = detection.kind === "componentSpec" ? this.services.schemas.componentSpec : this.services.schemas.screenSpec;
      const node = resolveSchemaAtPath(schema, path);
      const deref = node ? dereference(schema, node) : undefined;
      if (deref?.description) {
        return new vscode.Hover(new vscode.MarkdownString(deref.description));
      }
    }

    // @{data.name} hover: find the matching data entry and show its class/defaultValue.
    if (context.stringNode) {
      const text = getValue(context.stringNode);
      if (typeof text === "string") {
        const match = text.match(/@\{([A-Za-z_][A-Za-z0-9_]*)\}/);
        if (match) {
          const name = match[1];
          const dataNode = findAtLocation(context.document, ["data"]);
          if (dataNode?.type === "array") {
            for (const entry of dataNode.children ?? []) {
              if (entry.type !== "object") continue;
              const nameNode = entry.children?.find((c) => c.children?.[0]?.value === "name")?.children?.[1];
              if (getValue(nameNode) !== name) continue;
              const classNode = entry.children?.find((c) => c.children?.[0]?.value === "class")?.children?.[1];
              const defaultNode = entry.children?.find((c) => c.children?.[0]?.value === "defaultValue")?.children?.[1];
              const md = new vscode.MarkdownString();
              md.appendMarkdown(`**@${name}**\n\n`);
              if (classNode) md.appendMarkdown(`- class: ${mdCode(String(getValue(classNode)))}\n`);
              if (defaultNode) md.appendMarkdown(`- default: ${mdCode(JSON.stringify(getValue(defaultNode)))}\n`);
              return new vscode.Hover(md);
            }
          }
        }
      }
    }
    return undefined;
  }
}
