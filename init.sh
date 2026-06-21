#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

echo "Tiger Development Kit validation"
echo "root: $ROOT_DIR"

"$ROOT_DIR/scripts/validate-plugin.sh"

echo "startup: no runtime service required"
