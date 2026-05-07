#!/usr/bin/env bash
# Sync JsonUI spec source files into vendor/.
#
# Requires a local clone of jsonui-cli. Override JSONUI_CLI if not at the default.
set -euo pipefail

JSONUI_CLI=${JSONUI_CLI:-$HOME/resource/jsonui-cli}
HERE=$(cd "$(dirname "$0")/.." && pwd)
VENDOR="$HERE/vendor"

if [[ ! -d "$JSONUI_CLI" ]]; then
  echo "error: jsonui-cli not found at $JSONUI_CLI (set JSONUI_CLI env var)" >&2
  exit 1
fi

mkdir -p "$VENDOR"

# 1. Layout attribute definitions (plain JSON)
cp -f "$JSONUI_CLI/shared/core/attribute_definitions.json" "$VENDOR/attribute_definitions.json"

# 2. Responsive size classes (extracted from the Ruby constant)
python3 - <<'PY' > "$VENDOR/responsive_size_classes.json"
import json
size_classes = [
    "compact", "medium", "regular", "landscape",
    "compact-landscape", "medium-landscape", "regular-landscape",
]
priority = [
    "regular-landscape", "medium-landscape", "compact-landscape",
    "landscape", "regular", "medium", "compact",
]
print(json.dumps({"size_classes": size_classes, "priority": priority}, indent=2))
PY

# 3. Spec JSON schemas (exported from Python modules)
PYTHONPATH="$JSONUI_CLI" python3 - <<'PY' > "$VENDOR/screen_spec_schema.json"
import json
from document_tools.jsonui_doc_cli.spec_doc.screen_spec_schema import SCREEN_SPEC_SCHEMA
print(json.dumps(SCREEN_SPEC_SCHEMA, indent=2))
PY

PYTHONPATH="$JSONUI_CLI" python3 - <<'PY' > "$VENDOR/component_spec_schema.json"
import json
from document_tools.jsonui_doc_cli.spec_doc.component_spec_schema import COMPONENT_SPEC_SCHEMA
print(json.dumps(COMPONENT_SPEC_SCHEMA, indent=2))
PY

# 4. Built-in type map
PYTHONPATH="$JSONUI_CLI" python3 - <<'PY' > "$VENDOR/builtin_type_map.json"
import json
from jui_tools.jui_cli.core.type_mapper import _BUILTIN_TYPES
print(json.dumps(_BUILTIN_TYPES, indent=2))
PY

# 5. Version stamp
if git -C "$JSONUI_CLI" rev-parse HEAD >/dev/null 2>&1; then
  git -C "$JSONUI_CLI" rev-parse --short HEAD > "$VENDOR/VERSION"
else
  date +%Y%m%d-%H%M%S > "$VENDOR/VERSION"
fi

echo "Synced to $VENDOR (jsonui-cli @ $(cat "$VENDOR/VERSION"))"
ls -la "$VENDOR"
