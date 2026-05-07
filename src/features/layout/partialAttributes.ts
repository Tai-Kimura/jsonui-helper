import * as vscode from "vscode";
import type { CursorContext } from "../../ast/cursor";

const PARTIAL_ATTR_KEYS = [
  { name: "font", snippet: `"font": "\${1:bold}"` },
  { name: "fontSize", snippet: `"fontSize": \${1:14}` },
  { name: "fontColor", snippet: `"fontColor": "\${1:#000000}"` },
  { name: "lineSpacing", snippet: `"lineSpacing": \${1:1.2}` },
  { name: "lineHeightMultiple", snippet: `"lineHeightMultiple": \${1:1.2}` },
  { name: "lineBreakMode", snippet: `"lineBreakMode": "\${1|Tail,Word,Char,Clip,Head,Middle|}"` },
  { name: "textAlign", snippet: `"textAlign": "\${1|Left,Center,Right|}"` },
  { name: "underline", snippet: `"underline": {\n\t"lineStyle": "\${1|Single,Double,Thick|}",\n\t"color": "\${2:#000000}"\n}` },
  { name: "textShadow", snippet: `"textShadow": "color:\${1:#000000}|offset:\${2:0},\${3:1}|blur:\${4:3}"` },
  { name: "range", snippet: `"range": [\${1:0}, \${2:5}]` },
  { name: "onclick", snippet: `"onclick": "\${1:handleClick}"` },
];

export function providePartialAttributes(context: CursorContext): vscode.CompletionItem[] {
  if (context.positionKind !== "propertyName") return [];
  if (!context.jsonPath.includes("partialAttributes")) return [];
  return PARTIAL_ATTR_KEYS.map((entry) => {
    const name = new vscode.CompletionItem(entry.name, vscode.CompletionItemKind.Property);
    name.insertText = entry.name;
    name.detail = "partialAttributes";
    return name;
  }).concat(
    PARTIAL_ATTR_KEYS.map((entry) => {
      const snippet = new vscode.CompletionItem(`${entry.name}  (with value)`, vscode.CompletionItemKind.Snippet);
      snippet.filterText = entry.name;
      snippet.sortText = `1_${entry.name}`;
      snippet.insertText = new vscode.SnippetString(entry.snippet);
      return snippet;
    }),
  );
}
