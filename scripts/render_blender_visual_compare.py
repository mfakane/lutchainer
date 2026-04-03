from __future__ import annotations

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from setup_blender_visual_compare import setup_visual_compare


def _require_bpy():
    import bpy  # type: ignore

    return bpy


def render_blender_visual_compare(
    *,
    addon_parent: str,
    fixture_path: str,
    output_path: str,
    lightness_mode: str = "dot_nl",
    base_color: tuple[float, float, float] | None = (0.9, 0.9, 0.9),
    width: int = 512,
    height: int = 512,
) -> dict[str, object]:
    bpy = _require_bpy()

    compare_state = setup_visual_compare(
        addon_parent=addon_parent,
        fixture_path=fixture_path,
        lightness_mode=lightness_mode,
        base_color=base_color,
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

    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    render.filepath = output_path
    bpy.ops.render.render(write_still=True)

    return {
        "fixturePath": os.path.abspath(fixture_path),
        "lightnessMode": lightness_mode,
        "baseColor": list(base_color) if base_color is not None else None,
        "outputPath": output_path,
        "width": width,
        "height": height,
        "materialName": compare_state["material_name"],
    }


def main(argv: list[str]) -> int:
    separator_index = argv.index("--") if "--" in argv else -1
    args = argv[separator_index + 1 :] if separator_index >= 0 else []
    if len(args) < 3:
        print(
            "usage: blender --background --factory-startup --python scripts/render_blender_visual_compare.py -- "
            "<addon_parent> <fixture_path> <output_path> [lightness_mode] [width] [height] [base_color_r,base_color_g,base_color_b]"
        )
        return 2

    lightness_mode = args[3] if len(args) >= 4 else "dot_nl"
    width = int(args[4]) if len(args) >= 5 else 512
    height = int(args[5]) if len(args) >= 6 else 512
    base_color = (0.9, 0.9, 0.9)
    if len(args) >= 7:
        parts = [float(part.strip()) for part in args[6].split(",")]
        if len(parts) != 3:
            raise ValueError("base color must have 3 comma-separated components")
        base_color = (parts[0], parts[1], parts[2])
    result = render_blender_visual_compare(
        addon_parent=args[0],
        fixture_path=args[1],
        output_path=args[2],
        lightness_mode=lightness_mode,
        base_color=base_color,
        width=width,
        height=height,
    )
    print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
