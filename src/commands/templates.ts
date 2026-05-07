import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

interface TemplateDefinition {
  commandId: string;
  title: string;
  file: string;
}

const LAYOUT_TEMPLATES: TemplateDefinition[] = [
  { commandId: "jsonui-helper.insertView",         title: "JsonUI: Insert View",         file: "layout/view.json" },
  { commandId: "jsonui-helper.insertLabel",        title: "JsonUI: Insert Label",        file: "layout/label.json" },
  { commandId: "jsonui-helper.insertButton",       title: "JsonUI: Insert Button",       file: "layout/button.json" },
  { commandId: "jsonui-helper.insertTextField",    title: "JsonUI: Insert TextField",    file: "layout/textfield.json" },
  { commandId: "jsonui-helper.insertImage",        title: "JsonUI: Insert Image",        file: "layout/image.json" },
  { commandId: "jsonui-helper.insertScrollView",   title: "JsonUI: Insert ScrollView",   file: "layout/scrollview.json" },
  { commandId: "jsonui-helper.insertSafeAreaView", title: "JsonUI: Insert SafeAreaView", file: "layout/safeareaview.json" },
  { commandId: "jsonui-helper.insertCollection",   title: "JsonUI: Insert Collection",   file: "layout/collection.json" },
  { commandId: "jsonui-helper.insertTabView",      title: "JsonUI: Insert TabView",      file: "layout/tabview.json" },
  { commandId: "jsonui-helper.insertInclude",      title: "JsonUI: Insert Include",      file: "layout/include.json" },
];

const SPEC_TEMPLATES: TemplateDefinition[] = [
  { commandId: "jsonui-helper.insertScreenSpec",       title: "JsonUI: Insert screen_spec",       file: "spec/screen_spec.json" },
  { commandId: "jsonui-helper.insertScreenSubSpec",    title: "JsonUI: Insert screen_sub_spec",   file: "spec/screen_sub_spec.json" },
  { commandId: "jsonui-helper.insertScreenParentSpec", title: "JsonUI: Insert screen_parent_spec",file: "spec/screen_parent_spec.json" },
  { commandId: "jsonui-helper.insertComponentSpec",    title: "JsonUI: Insert component_spec",    file: "spec/component_spec.json" },
  { commandId: "jsonui-helper.insertRepository",       title: "JsonUI: Insert Repository",        file: "spec/repository.json" },
  { commandId: "jsonui-helper.insertUseCase",          title: "JsonUI: Insert UseCase",           file: "spec/usecase.json" },
  { commandId: "jsonui-helper.insertApiEndpoint",      title: "JsonUI: Insert ApiEndpoint",       file: "spec/api_endpoint.json" },
];

function loadTemplate(extensionRoot: string, file: string): string {
  return fs.readFileSync(path.join(extensionRoot, "templates", file), "utf8");
}

async function insertTemplate(editor: vscode.TextEditor, body: string): Promise<void> {
  const snippet = new vscode.SnippetString(body);
  await editor.insertSnippet(snippet);
  void vscode.commands.executeCommand("editor.action.formatDocument");
}

export function registerTemplateCommands(context: vscode.ExtensionContext): void {
  const extensionRoot = context.extensionPath;
  const register = (def: TemplateDefinition) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(def.commandId, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage("JsonUI: no active editor.");
          return;
        }
        try {
          const body = loadTemplate(extensionRoot, def.file);
          await insertTemplate(editor, body);
        } catch (err) {
          vscode.window.showErrorMessage(`JsonUI: failed to load template ${def.file}: ${(err as Error).message}`);
        }
      }),
    );
  };
  for (const t of LAYOUT_TEMPLATES) register(t);
  for (const t of SPEC_TEMPLATES) register(t);
}
