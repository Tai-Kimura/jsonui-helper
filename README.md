# JsonUI Helper

VSCode editing support for [JsonUI](https://github.com/Tai-Kimura/SwiftJsonUI) projects managed with
`jui_tools`. Layout JSON, Screen Spec, Component Spec, Styles and Strings all get first-class completion,
hover, navigation and diagnostics.

## Features

### Layout JSON

- Component `type` completion (28 components) with auto-filled `width` / `height` / `child` scaffolding.
- Property-name completion filtered by the surrounding component type (common + per-component attributes).
- Property-value completion:
  - enum values (`textAlign`, `contentMode`, `visibility`, `lineBreakMode`, `borderStyle`, ...)
  - `width` / `height` → `matchParent` / `wrapContent` / number,
  - color properties → registered names from `colors.json` / `defined_colors.json` + `#RRGGBB`,
  - `text` / `hint` → nested keys from `strings.json` (navigate with `_`),
  - `style` → basenames from `Styles/`,
  - `include` / `view` / `cellClasses[]` / `sections[].cell/header/footer` → layout files under
    `layouts_directory`,
  - `src` → SVG files under `images_directory`,
  - `alignTopOfView` / `alignBottomOfView` / etc. → sibling component ids,
  - `@{...}` → `data[].name` from the current file.
- Platform overrides: `"platform": { "ios": { ... } }` suggests attributes for the nested block; the
  root-level `"platforms": [...]` suggests `ios` / `android` / `web`.
- Responsive: size class keys (`compact`, `medium`, `regular`, `landscape`, plus the three
  `-landscape` variants) and attribute completion inside each block.
- `partialAttributes[]` completion.
- `data[].class` completion from the built-in type map plus any project-level `.jsonui-type-map.json`.

### Screen Spec / Component Spec (`*.spec.json`)

- Schema-driven completion based on the official JSON Schemas (`screen_spec`, `screen_sub_spec`,
  `screen_parent_spec`, `component_spec`) — property names, enum values and object skeletons are all
  derived automatically.
- `metadata.platforms` and method-level `platforms` → `ios` / `android` / `web` choice.
- `metadata.layoutFile` → layout file completion.
- `subSpecs[].file` / `structure.customComponents[].specFile` → spec file completion.
- `structure.components[].style` → attribute completion for the component's `type`.
- `structure.components[].binding` → attributes that support binding.
- `dataFlow.*.methods[*].params[*].type` / `returnType` → concrete types from `.jsonui-type-map.json`
  plus generic patterns (`[$T]`, `$T?`, `Array($T)`, `AsyncThrowingStream<$T,$E>`, ...).
- `useCases[].repositories` → cross-reference to `repositories[].name` in the same spec.
- `displayLogic[].effects[].element` → cross-reference to `structure.components[].id`.

### Navigation & hover

- `⌘+click` / `Ctrl+click` jumps from any reference value (`include`, `view`, `style`, `layoutFile`,
  `cellClasses[]`, `cell`/`header`/`footer`, `subSpecs[].file`, `specFile`) to the target file. The
  same paths are rendered as clickable DocumentLinks.
- Hovering over an attribute name shows its description, accepted types, and any `platform` / `mode`
  metadata.
- Hovering over `@{name}` shows the `class` and `defaultValue` from the corresponding `data[]` entry.

### Diagnostics

Run automatically on open and on edit (debounced). Disable with
`"jsonuiHelper.diagnostics.enabled": false`.

**Layout**: unknown attributes, enum violations, unresolved `include` / `view` / `style` /
`cellClasses[]`, `hidden` + `visibility` used together, duplicate `id`, invalid `platform` /
`responsive` keys.

**Spec**: unresolved `layoutFile` / `subSpecs[].file` / `customComponents[].specFile`, duplicate
component ids, dangling `displayLogic.effects[].element`, undefined Repository referenced by a
UseCase, iOS-only types (`UIImage`, `inout`, labelled tuples, …) used without `platforms: ["ios"]`.

### Templates

| Command | Default keybinding | Scope |
|--|--|--|
| Insert View | `⌘⇧V` / `Ctrl+Shift+V` | Layout |
| Insert Label | `⌘⇧L` / `Ctrl+Shift+L` | Layout |
| Insert Button | `⌘⇧B` / `Ctrl+Shift+B` | Layout |
| Insert ScrollView | `⌘⇧S` / `Ctrl+Shift+S` | Layout |
| Insert SafeAreaView | `⌘⇧A` / `Ctrl+Shift+A` | Layout |
| Insert Collection | `⌘⇧C` / `Ctrl+Shift+C` | Layout |
| Insert TextField / Image / TabView / Include | — | Layout |
| Insert screen_spec / screen_sub_spec / screen_parent_spec / component_spec | — | Spec |
| Insert Repository / UseCase / ApiEndpoint | — | Spec |

## Configuration

| Setting | Default | Meaning |
|--|--|--|
| `jsonuiHelper.configFile` | `jui.config.json` | Config filename (resolved from workspace root). |
| `jsonuiHelper.layoutsDirectory` | `""` (read from config) | Override for `layouts_directory`. |
| `jsonuiHelper.specDirectory`    | `""` | Override for `spec_directory`. |
| `jsonuiHelper.stylesDirectory`  | `""` | Override for `styles_directory`. |
| `jsonuiHelper.stringsFile`      | `""` | Override for `strings_file`. |
| `jsonuiHelper.diagnostics.enabled` | `true` | Toggle diagnostics. |

## How it resolves paths

All file references in Layout JSON and Spec JSON are relative to `layouts_directory` /
`spec_directory`, not to the current file's directory. `"bar_list/bar_cell"` resolves to
`{layouts_directory}/bar_list/bar_cell.json` regardless of where you wrote it.

## Privacy

No telemetry, no network calls. See [PRIVACY.md](PRIVACY.md).

## License

MIT. See [LICENSE](LICENSE).
