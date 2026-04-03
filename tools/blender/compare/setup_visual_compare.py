from __future__ import annotations

import json
import math
import os
import sys
from typing import Any


ADDON_MODULE_NAME = "lutchainer_blender_addon"
DEFAULT_COMPARE_BASE_COLOR = (0.9, 0.9, 0.9)
MATERIAL_PRESETS = {
    "default": {
        "baseColor": (0.9, 0.9, 0.9),
        "specularStrength": 0.4,
        "specularPower": 24.0,
        "fresnelStrength": 0.18,
        "fresnelPower": 2.2,
    },
    "matte-clay": {
        "baseColor": (0.70, 0.62, 0.54),
        "specularStrength": 0.12,
        "specularPower": 7.0,
        "fresnelStrength": 0.08,
        "fresnelPower": 1.4,
    },
    "gloss-metal": {
        "baseColor": (0.78, 0.80, 0.84),
        "specularStrength": 1.05,
        "specularPower": 72.0,
        "fresnelStrength": 0.36,
        "fresnelPower": 3.6,
    },
    "neon-lacquer": {
        "baseColor": (0.18, 0.82, 0.95),
        "specularStrength": 0.62,
        "specularPower": 44.0,
        "fresnelStrength": 0.46,
        "fresnelPower": 2.8,
    },
}


def _require_bpy():
    import bpy  # type: ignore

    return bpy


def _register_addon(addon_parent: str) -> None:
    addons_dir = os.path.join(addon_parent, "addons")
    if addons_dir not in sys.path:
        sys.path.insert(0, addons_dir)

    import addon_utils  # type: ignore

    try:
        addon_utils.disable(ADDON_MODULE_NAME, default_set=True)
    except Exception:
        pass
    addon_utils.enable(ADDON_MODULE_NAME, default_set=True)


def _configure_preferences(bpy: Any, fixture_path: str, lightness_mode: str) -> None:
    addon = bpy.context.preferences.addons.get(ADDON_MODULE_NAME)
    if addon is None:
        raise RuntimeError("add-on preferences are not available")
    prefs = addon.preferences
    prefs.last_fixture_path = fixture_path
    prefs.lightness_mode_default = lightness_mode


def _set_standard_color_management(bpy: Any) -> None:
    scene = bpy.context.scene
    scene.display_settings.display_device = "sRGB"
    scene.view_settings.view_transform = "Standard"
    scene.sequencer_colorspace_settings.name = "sRGB"


def _set_black_world(bpy: Any) -> None:
    scene = bpy.context.scene
    world = scene.world
    if world is None:
        world = bpy.data.worlds.new(name="Lutchainer Compare World")
        scene.world = world

    world.use_nodes = True
    node_tree = world.node_tree
    if node_tree is None:
        raise RuntimeError("world node tree is not available")

    background = node_tree.nodes.get("Background")
    if background is None:
        background = node_tree.nodes.new("ShaderNodeBackground")
    background.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    background.inputs["Strength"].default_value = 0.0


def _remove_default_cube(bpy: Any) -> None:
    cube = bpy.data.objects.get("Cube")
    if cube is None:
        return
    bpy.data.objects.remove(cube, do_unlink=True)


def _clear_compare_scene(bpy: Any) -> None:
    scene = bpy.context.scene

    for obj in list(scene.objects):
        obj_name = obj.name
        if obj_name in {scene.camera.name if scene.camera else "", "Camera", "Light"}:
            continue
        bpy.data.objects.remove(obj, do_unlink=True)

    for obj_name in ("Lutchainer Compare Camera", "Camera"):
        obj = bpy.data.objects.get(obj_name)
        if obj is not None and obj.type == "CAMERA":
            bpy.data.objects.remove(obj, do_unlink=True)

    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material, do_unlink=True)


def _create_subject(bpy: Any) -> Any:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=64,
        ring_count=32,
        radius=1.0,
        location=(0.0, 0.0, 0.0),
    )
    obj = bpy.context.object
    if obj is None:
        raise RuntimeError("failed to create validation sphere")
    obj.name = "Lutchainer Compare Sphere"
    bpy.ops.object.shade_smooth()
    return obj


def _create_camera(bpy: Any) -> Any:
    from mathutils import Vector  # type: ignore

    orbit_pitch_deg = 25.0
    orbit_yaw_deg = 45.0
    orbit_dist = 2.8
    orbit_pitch_rad = math.radians(orbit_pitch_deg)
    orbit_yaw_rad = math.radians(orbit_yaw_deg)
    eye_y = math.sin(orbit_pitch_rad) * orbit_dist
    r_xz = math.cos(orbit_pitch_rad) * orbit_dist
    eye_x = math.sin(orbit_yaw_rad) * r_xz
    eye_z = math.cos(orbit_yaw_rad) * r_xz

    # Browser preview uses Y-up coordinates.
    # Blender uses Z-up and the front view is aligned on -Y, so convert:
    # browser (x, y, z) -> blender (x, -z, y)
    camera_location = (eye_x, -eye_z, eye_y)

    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.object
    if camera is None:
        raise RuntimeError("failed to create comparison camera")
    camera.name = "Lutchainer Compare Camera"
    camera.data.angle = math.pi / 4
    look_direction = Vector((0.0, 0.0, 0.0)) - camera.location
    camera.rotation_euler = look_direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera
    return camera


def _set_active_object(bpy: Any, obj: Any) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def _normalize_base_color(base_color: tuple[float, float, float] | None) -> tuple[float, float, float, float] | None:
    if base_color is None:
        return None
    def srgb_to_linear(component: float) -> float:
        if component <= 0.04045:
            return component / 12.92
        return ((component + 0.055) / 1.055) ** 2.4
    return (
        srgb_to_linear(float(base_color[0])),
        srgb_to_linear(float(base_color[1])),
        srgb_to_linear(float(base_color[2])),
        1.0,
    )


def _resolve_compare_material_settings(
    base_color: tuple[float, float, float] | None,
    material_preset_key: str | None,
) -> dict[str, object]:
    preset_key = material_preset_key or "default"
    if preset_key not in MATERIAL_PRESETS:
        raise ValueError(f"Unknown material preset: {preset_key}")
    preset = MATERIAL_PRESETS[preset_key]
    resolved_base = base_color if base_color is not None else preset["baseColor"]
    normalized_base = _normalize_base_color(resolved_base)
    if normalized_base is None:
        raise RuntimeError("base color normalization failed")
    return {
        "baseColor": normalized_base,
        "specularStrength": float(preset["specularStrength"]),
        "specularPower": float(preset["specularPower"]),
        "fresnelStrength": float(preset["fresnelStrength"]),
        "fresnelPower": float(preset["fresnelPower"]),
        "presetKey": preset_key,
    }


def setup_visual_compare(
    *,
    addon_parent: str,
    fixture_path: str,
    lightness_mode: str = "dot_nl",
    base_color: tuple[float, float, float] | None = None,
    material_preset_key: str | None = None,
    reset_scene: bool = True,
) -> dict[str, str]:
    bpy = _require_bpy()

    addon_parent = os.path.abspath(addon_parent)
    fixture_path = os.path.abspath(fixture_path)

    if reset_scene:
        _clear_compare_scene(bpy)

    _register_addon(addon_parent)
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    _set_standard_color_management(bpy)
    _set_black_world(bpy)
    _remove_default_cube(bpy)
    subject = _create_subject(bpy)
    _create_camera(bpy)
    _set_active_object(bpy, subject)
    _configure_preferences(bpy, fixture_path, lightness_mode)

    result = bpy.ops.lutchainer.reload_script()
    if "FINISHED" not in result:
        raise RuntimeError("reload_script did not finish successfully")

    result = bpy.ops.lutchainer.import_lutchain(
        filepath=fixture_path,
        lightness_mode=lightness_mode,
    )
    if "FINISHED" not in result:
        raise RuntimeError("import_lutchain did not finish successfully")

    material = subject.active_material
    if material is None:
        raise RuntimeError("import did not assign an active material")

    compare_material_settings = _resolve_compare_material_settings(base_color, material_preset_key)

    if base_color is not None or material_preset_key is not None:
        import lutchainer_blender_addon as addon_module  # type: ignore

        bpy.data.materials.remove(material, do_unlink=True)
        material = addon_module.run_import_from_path(
            context=bpy.context,
            filepath=fixture_path,
            lightness_mode=lightness_mode,
            base_color=compare_material_settings["baseColor"],
            material_settings=compare_material_settings,
        )

    return {
        "fixture_path": fixture_path,
        "lightness_mode": lightness_mode,
        "material_name": material.name,
        "object_name": subject.name,
        "camera_name": bpy.context.scene.camera.name if bpy.context.scene.camera else "",
        "base_color": json.dumps(list(base_color)) if base_color is not None else "",
        "material_preset_key": compare_material_settings["presetKey"],
    }


def main(argv: list[str]) -> int:
    separator_index = argv.index("--") if "--" in argv else -1
    args = argv[separator_index + 1 :] if separator_index >= 0 else []
    if len(args) < 2:
        print(
            "usage: blender --background --factory-startup --python tools/blender/compare/setup_visual_compare.py -- "
            "<addon_parent> <fixture_path> [lightness_mode] [base_color_r,base_color_g,base_color_b] [material_preset_key]"
        )
        return 2

    lightness_mode = args[2] if len(args) >= 3 else "dot_nl"
    base_color: tuple[float, float, float] | None = None
    if len(args) >= 4:
        parts = [float(part.strip()) for part in args[3].split(",")]
        if len(parts) != 3:
            raise ValueError("base color must have 3 comma-separated components")
        base_color = (parts[0], parts[1], parts[2])
    material_preset_key = args[4] if len(args) >= 5 else None
    result = setup_visual_compare(
        addon_parent=args[0],
        fixture_path=args[1],
        lightness_mode=lightness_mode,
        base_color=base_color,
        material_preset_key=material_preset_key,
        reset_scene=True,
    )
    print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
