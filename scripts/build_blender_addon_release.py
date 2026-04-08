from __future__ import annotations

import re
import shutil
import sys
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


REPO_ROOT = Path(__file__).resolve().parent.parent
ADDON_SOURCE_DIR = REPO_ROOT / "blender_addon" / "addons" / "lutchainer_blender_addon"
ARTIFACTS_DIR = REPO_ROOT / "artifacts"
PACKAGE_NAME = "lutchainer_blender_addon"
VERSION_PATTERN = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
BL_INFO_VERSION_PATTERN = re.compile(r'"version":\s*\(\d+,\s*\d+,\s*\d+\),')
RELEASE_FLAG_PATTERN = re.compile(r"IS_RELEASE_BUILD\s*=\s*(True|False)")


def _parse_version(raw_version: str) -> tuple[str, tuple[int, int, int]]:
    match = VERSION_PATTERN.match(raw_version)
    if match is None:
        raise ValueError("version must be in X.Y.Z format")
    parts = match.groups()
    return raw_version, (int(parts[0]), int(parts[1]), int(parts[2]))


def _replace_bl_info_version(filepath: Path, version_tuple: tuple[int, int, int]) -> None:
    contents = filepath.read_text(encoding="utf-8")
    replacement = f'"version": ({version_tuple[0]}, {version_tuple[1]}, {version_tuple[2]}),'
    updated = BL_INFO_VERSION_PATTERN.sub(replacement, contents, count=1)
    if updated == contents:
        raise ValueError(f"failed to update bl_info version in {filepath}")
    filepath.write_text(updated, encoding="utf-8")


def _set_release_flag(filepath: Path, is_release_build: bool) -> None:
    contents = filepath.read_text(encoding="utf-8")
    replacement = f"IS_RELEASE_BUILD = {str(is_release_build)}"
    updated = RELEASE_FLAG_PATTERN.sub(replacement, contents, count=1)
    if updated == contents:
        raise ValueError(f"failed to update release flag in {filepath}")
    filepath.write_text(updated, encoding="utf-8")


def _build_zip_from_directory(source_dir: Path, output_zip: Path) -> None:
    with ZipFile(output_zip, "w", compression=ZIP_DEFLATED) as archive:
        for filepath in sorted(source_dir.rglob("*")):
            if filepath.is_dir():
                continue
            archive.write(filepath, filepath.relative_to(source_dir.parent))


def build_release(version: str) -> Path:
    version_text, version_tuple = _parse_version(version)
    if not ADDON_SOURCE_DIR.is_dir():
        raise FileNotFoundError(f"add-on source not found: {ADDON_SOURCE_DIR}")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    output_zip = ARTIFACTS_DIR / f"{PACKAGE_NAME}-{version_text}.zip"

    with tempfile.TemporaryDirectory(prefix="lutchainer-blender-release-") as tmpdir:
        staging_root = Path(tmpdir)
        staged_package_dir = staging_root / PACKAGE_NAME
        shutil.copytree(
            ADDON_SOURCE_DIR,
            staged_package_dir,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo"),
        )
        _replace_bl_info_version(staged_package_dir / "__init__.py", version_tuple)
        _set_release_flag(staged_package_dir / "release_config.py", True)
        _build_zip_from_directory(staged_package_dir, output_zip)

    return output_zip


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python3 scripts/build_blender_addon_release.py <version>")
        return 2

    output_zip = build_release(argv[1])
    print(str(output_zip))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
