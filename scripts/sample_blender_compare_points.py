from __future__ import annotations

import json
import os
import sys
import tempfile
from typing import Any

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from setup_blender_visual_compare import setup_visual_compare

DEFAULT_RENDER_SIZE = 512
DEFAULT_GRID_DIVISIONS = 8
DEFAULT_ORBIT = {
    "orbitPitchDeg": 25.0,
    "orbitYawDeg": 45.0,
    "orbitDist": 2.8,
}


def _require_bpy():
    import bpy  # type: ignore

    return bpy


def _sample_image_pixel(image: Any, x: int, y: int) -> list[int]:
    width = image.size[0]
    height = image.size[1]
    clamped_x = max(0, min(width - 1, x))
    clamped_y = max(0, min(height - 1, y))
    offset = (clamped_y * width + clamped_x) * 4
    pixels = image.pixels
    return [
        round(max(0.0, min(1.0, pixels[offset + 0])) * 255),
        round(max(0.0, min(1.0, pixels[offset + 1])) * 255),
        round(max(0.0, min(1.0, pixels[offset + 2])) * 255),
        round(max(0.0, min(1.0, pixels[offset + 3])) * 255),
    ]


def _build_grid_samples(image: Any, width: int, height: int, divisions: int) -> list[dict[str, object]]:
    safe_divisions = max(1, int(divisions))
    samples: list[dict[str, object]] = []
    for row in range(safe_divisions):
        for col in range(safe_divisions):
            pixel_x = round(((col + 0.5) / safe_divisions) * (width - 1))
            pixel_y = round(((row + 0.5) / safe_divisions) * (height - 1))
            samples.append({
                "id": f"r{row}-c{col}",
                "row": row,
                "col": col,
                "pixel": [pixel_x, pixel_y],
                "rgba": _sample_image_pixel(image, pixel_x, height - 1 - pixel_y),
            })
    return samples


def sample_blender_compare_points(
    *,
    addon_parent: str,
    fixture_path: str,
    lightness_mode: str = "dot_nl",
    width: int = DEFAULT_RENDER_SIZE,
    height: int = DEFAULT_RENDER_SIZE,
    divisions: int = DEFAULT_GRID_DIVISIONS,
) -> dict[str, object]:
    bpy = _require_bpy()
    compare_state = setup_visual_compare(
        addon_parent=addon_parent,
        fixture_path=fixture_path,
        lightness_mode=lightness_mode,
        reset_scene=True,
    )

    scene = bpy.context.scene
    render = scene.render
    render.engine = "BLENDER_EEVEE"
    render.resolution_percentage = 100
    render.resolution_x = width
    render.resolution_y = height
    render.image_settings.file_format = "PNG"
    render.image_settings.color_mode = "RGBA"

    handle, filepath = tempfile.mkstemp(suffix=".png", prefix="lutchainer-compare-")
    os.close(handle)
    render.filepath = filepath
    bpy.ops.render.render(write_still=True)

    image = bpy.data.images.load(filepath, check_existing=False)
    try:
        samples = _build_grid_samples(image, width, height, divisions)
    finally:
        bpy.data.images.remove(image)
        try:
            os.remove(filepath)
        except OSError:
            pass

    return {
        "canvas": {"width": width, "height": height},
        "orbit": DEFAULT_ORBIT,
        "divisions": divisions,
        "lightnessMode": lightness_mode,
        "fixturePath": os.path.abspath(fixture_path),
        "materialName": compare_state["material_name"],
        "samples": samples,
    }


def main(argv: list[str]) -> int:
    separator_index = argv.index("--") if "--" in argv else -1
    args = argv[separator_index + 1 :] if separator_index >= 0 else []
    if len(args) < 2:
        print(
            "usage: blender --background --factory-startup --python scripts/sample_blender_compare_points.py -- "
            "<addon_parent> <fixture_path> [lightness_mode] [size] [divisions]"
        )
        return 2

    lightness_mode = args[2] if len(args) >= 3 else "dot_nl"
    size = int(args[3]) if len(args) >= 4 else DEFAULT_RENDER_SIZE
    divisions = int(args[4]) if len(args) >= 5 else DEFAULT_GRID_DIVISIONS
    result = sample_blender_compare_points(
        addon_parent=args[0],
        fixture_path=args[1],
        lightness_mode=lightness_mode,
        width=size,
        height=size,
        divisions=divisions,
    )
    print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
