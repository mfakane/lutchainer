#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
POWERSHELL_EXE="${POWERSHELL_EXE:-/mnt/c/Program Files/PowerShell/7/pwsh.exe}"

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/run_windows_blender.sh <script.ps1> [args...]" >&2
  exit 2
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env not found at $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${BLENDER_EXECUTABLE:-}" ]]; then
  echo "BLENDER_EXECUTABLE is not set in $ENV_FILE" >&2
  exit 1
fi

TARGET_SCRIPT="$1"
shift

if [[ "$TARGET_SCRIPT" != /* ]]; then
  TARGET_SCRIPT="$SCRIPT_DIR/$TARGET_SCRIPT"
fi

if [[ ! -f "$TARGET_SCRIPT" ]]; then
  echo "PowerShell script not found: $TARGET_SCRIPT" >&2
  exit 1
fi

exec "$POWERSHELL_EXE" -ExecutionPolicy Bypass -File "$TARGET_SCRIPT" -BlenderExe "$BLENDER_EXECUTABLE" "$@"
