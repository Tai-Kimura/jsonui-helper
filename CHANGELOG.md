# Changelog

All notable changes to the **JsonUI Helper** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-21

### Changed
- Resynced vendor spec snapshot from jsonui-cli `34a37e4`.
  - `cellNode.layoutFile` is now the canonical cell reference key; the legacy
    `cellNode.layout` is accepted as a deprecated fallback.
  - Refreshes `attribute_definitions.json` and `builtin_type_map.json` with
    upstream improvements (binding direction metadata, closure type translation,
    Bitmap built-in, allow commas inside generic captures, etc.).

## [0.1.0] - 2026-04-20

Initial release.

### Added
- Spec-driven completion for Layout JSON (component `type`, common + per-component attributes, enums, references).
- Layout reference completion and ⌘+click navigation (`include`, `view`, `cellClasses[]`, `sections.cell/header/footer`, `style`).
- Strings / colors / images / sibling-id completions.
- `@{...}` binding completion from the current file's `data[]` block.
- `"platform"` object override, `"platforms"` array whitelist, and `"responsive"` size-class completion (7 size classes).
- `data[].class` completion driven by `.jsonui-type-map.json` + built-in type map.
- `partialAttributes[]` completion.
- Screen Spec / Component Spec support:
  - `type`: `screen_spec` / `screen_sub_spec` / `screen_parent_spec` / `component_spec`.
  - Schema-driven property-name and enum-value completion from the official JSON Schemas.
  - `metadata.layoutFile`, `subSpecs[].file`, `structure.customComponents[].specFile` references.
  - `structure.components[].style` / `.binding` attribute completion.
  - `dataFlow.*.methods[*].params[*].type` / `returnType` type completion.
  - `useCases[].repositories` cross-reference, `displayLogic.effects[].element` component id cross-reference.
- Hover: attribute description + types, spec schema descriptions, `@{name}` binding info.
- DocumentLinks for every file reference path.
- Diagnostics (opt-out via `jsonuiHelper.diagnostics.enabled`):
  - Layout: unknown attribute / enum violation / unresolved include/view/style/cellClasses / `hidden`+`visibility` / duplicate ids / invalid `platform` / `responsive` keys.
  - Spec: unresolved `layoutFile` / subSpecs / customComponents, duplicate component ids, dangling `displayLogic.element`, undefined Repository reference, iOS-only types without `platforms: ["ios"]`.
- 10 layout + 7 spec insertion templates (snippet-based, keybindings for the most common ones).
- Respects `jui.config.json` for `layouts_directory` / `spec_directory` / `styles_directory` / `strings_file` / `images_directory`.
- Project-level config `.jsonui-type-map.json` and `.jsonui-doc-rules.json` merged into completions.

### Tracked vendor versions

- `attribute_definitions.json` (shared/core)
- `screen_spec_schema.json` / `component_spec_schema.json` (document_tools)
- `builtin_type_map.json` (jui_tools)
- `responsive_size_classes.json`

Run `npm run sync:specs` to refresh them.
