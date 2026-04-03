#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
POWERSHELL_EXE="${POWERSHELL_EXE:-pwsh.exe}"

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/run_windows_blender.sh <script.ps1> [args...]" >&2
  exit 2
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${BLENDER_EXECUTABLE:-}" ]]; then
  echo "BLENDER_EXECUTABLE is not set" >&2
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

convert_path_like_arg() {
  local arg="$1"
  local candidate=""

  if [[ "$arg" == -* || "$arg" == "--" ]]; then
    printf '%s\n' "$arg"
    return 0
  fi

  if [[ "$arg" == *"|"* ]]; then
    local converted_parts=()
    local old_ifs="$IFS"
    IFS='|'
    read -r -a path_parts <<< "$arg"
    IFS="$old_ifs"
    local part
    for part in "${path_parts[@]}"; do
      converted_parts+=("$(convert_path_like_arg "$part")")
    done
    local joined=""
    local index
    for index in "${!converted_parts[@]}"; do
      if [[ "$index" -gt 0 ]]; then
        joined+="|"
      fi
      joined+="${converted_parts[$index]}"
    done
    printf '%s\n' "$joined"
    return 0
  fi

  if [[ "$arg" == /* ]]; then
    candidate="$arg"
  elif [[ "$arg" == ./* || "$arg" == ../* || "$arg" == */* ]]; then
    candidate="$(realpath -m "$arg")"
  elif [[ -e "$arg" || -d "$(dirname "$arg")" ]]; then
    candidate="$(realpath -m "$arg")"
  else
    printf '%s\n' "$arg"
    return 0
  fi

  if [[ -e "$candidate" || -d "$(dirname "$candidate")" ]]; then
    wslpath -w "$candidate"
    return 0
  fi

  printf '%s\n' "$arg"
}

CONVERTED_ARGS=()
for arg in "$@"; do
  CONVERTED_ARGS+=("$(convert_path_like_arg "$arg")")
done

if [[ "$(basename "$TARGET_SCRIPT")" == "invoke_windows_blender.ps1" ]]; then
  ENCODED_ARGS="$(printf '%s\n' "${CONVERTED_ARGS[@]}")"
  exec "$POWERSHELL_EXE" -ExecutionPolicy Bypass -File "$TARGET_SCRIPT" -BlenderExe "$BLENDER_EXECUTABLE" -BlenderArgsEncoded "$ENCODED_ARGS"
fi

exec "$POWERSHELL_EXE" -ExecutionPolicy Bypass -File "$TARGET_SCRIPT" -BlenderExe "$BLENDER_EXECUTABLE" "${CONVERTED_ARGS[@]}"
