#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/run_windows_blender.sh [--env ENVFILE] [--ps1 SCRIPTFILE] [ARG...]" >&2
  echo "  --env    Specify a custom .env file to load environment variables from (default: .env in repo root)" >&2
  echo "  --ps1    Specify a custom PowerShell script to invoke (default: invoke_windows_blender.ps1 in the same directory as this script)" >&2
  echo "  ARG...   Arguments to pass to Blender (WSL paths will be converted to Windows format automatically)" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/.env"
POWERSHELL_EXE="${POWERSHELL_EXE:-pwsh.exe}"
SCRIPT_FILE="$SCRIPT_DIR/invoke_windows_blender.ps1"
IGNORED_ARGS=()

while [[ $(($# - ${#IGNORED_ARGS[@]})) -gt 0 ]]; do
  case "$1" in
    --env)
      shift
      if [[ $(($# - ${#IGNORED_ARGS[@]})) -gt 0 ]]; then
        ENV_FILE="$1"
        shift
      else
        echo "Error: --env requires an argument" >&2
        exit 1
      fi
      ;;
    --ps1)
      shift
      if [[ $(($# - ${#IGNORED_ARGS[@]})) -gt 0 ]]; then
        SCRIPT_FILE="$1"
        shift
      else
        echo "Error: --ps1 requires an argument" >&2
        exit 1
      fi
      ;;
    *)
      IGNORED_ARGS+=("$1")
      shift
      ;;
  esac
done

# unshift the ignored args back to the positional parameters
set -- "${IGNORED_ARGS[@]}" "$@"

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

if [[ ! -f "$SCRIPT_FILE" ]]; then
  echo "PowerShell script not found: $SCRIPT_FILE" >&2
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

if [[ "$(basename "$SCRIPT_FILE")" == "invoke_windows_blender.ps1" ]]; then
  ENCODED_ARGS="$(printf '%s\n' "${CONVERTED_ARGS[@]}")"
  exec "$POWERSHELL_EXE" -ExecutionPolicy Bypass -File "$SCRIPT_FILE" -BlenderExe "$BLENDER_EXECUTABLE" -BlenderArgsEncoded "$ENCODED_ARGS"
fi

exec "$POWERSHELL_EXE" -ExecutionPolicy Bypass -File "$SCRIPT_FILE" -BlenderExe "$BLENDER_EXECUTABLE" "${CONVERTED_ARGS[@]}"
