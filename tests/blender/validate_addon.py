from __future__ import annotations

import json
import os
import sys
import zipfile


def _require_bpy():
    import bpy  # type: ignore

    return bpy


def _load_manifest(filepath: str) -> dict[str, object]:
    with zipfile.ZipFile(filepath, "r") as archive:
        return json.loads(archive.read("pipeline.json").decode("utf-8"))


def _register_addon(addon_parent: str) -> None:
    addons_dir = os.path.join(addon_parent, "addons")
    if addons_dir not in sys.path:
        sys.path.insert(0, addons_dir)
    import addon_utils  # type: ignore

    try:
        addon_utils.disable("lutchainer_blender_addon", default_set=True)
    except Exception:
        pass
    addon_utils.enable("lutchainer_blender_addon", default_set=True)


def _configure_preferences(bpy, addon_parent: str, fixture_path: str, lightness_mode: str) -> None:
    addon = bpy.context.preferences.addons.get("lutchainer_blender_addon")
    if addon is None:
        raise AssertionError("add-on preferences are not available")
    prefs = addon.preferences
    prefs.last_fixture_path = fixture_path
    prefs.lightness_mode_default = lightness_mode


def _create_validation_object(bpy) -> None:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1.0)


def _assert_pipeline_structure(bpy, fixture_path: str) -> None:
    manifest = _load_manifest(fixture_path)
    material = bpy.context.object.active_material
    if material is None:
        raise AssertionError(f"{fixture_path}: active material was not created")

    material_tree = material.node_tree
    pipeline_nodes = [
        node for node in material_tree.nodes
        if node.bl_idname == "ShaderNodeGroup" and node.get("lutchainer_kind") == "pipeline_node"
    ]
    if len(pipeline_nodes) != 1:
        raise AssertionError(f"{fixture_path}: expected exactly one pipeline node, found {len(pipeline_nodes)}")

    pipeline_tree = pipeline_nodes[0].node_tree
    if pipeline_tree.get("lutchainer_kind") != "pipeline":
        raise AssertionError(f"{fixture_path}: pipeline node tree metadata is missing")

    expected_steps = manifest["steps"]
    step_nodes = [
        node for node in pipeline_tree.nodes
        if node.bl_idname == "ShaderNodeGroup" and node.get("lutchainer_kind") == "step_node"
    ]
    if len(step_nodes) != len(expected_steps):
        raise AssertionError(
            f"{fixture_path}: expected {len(expected_steps)} step nodes, found {len(step_nodes)}"
        )

    ordered_nodes = sorted(step_nodes, key=lambda node: int(node["lutchainer_step_index"]))
    for index, (node, step) in enumerate(zip(ordered_nodes, expected_steps)):
        if str(node["lutchainer_step_id"]) != str(step["id"]):
            raise AssertionError(f"{fixture_path}: step {index} id mismatch")
        if str(node["lutchainer_blend_mode"]) != step["blendMode"]:
            raise AssertionError(f"{fixture_path}: step {index} blend mode mismatch")
        if str(node["lutchainer_x_param"]) != step["xParam"]:
            raise AssertionError(f"{fixture_path}: step {index} xParam mismatch")
        if str(node["lutchainer_y_param"]) != step["yParam"]:
            raise AssertionError(f"{fixture_path}: step {index} yParam mismatch")

        step_tree = node.node_tree
        if step_tree.get("lutchainer_kind") != "step":
            raise AssertionError(f"{fixture_path}: step {index} group metadata is missing")

    print(
        f"validated {os.path.basename(fixture_path)}: "
        f"{len(expected_steps)} step nodes, material={material.name}"
    )


def main(argv: list[str]) -> int:
    separator_index = argv.index("--") if "--" in argv else -1
    args = argv[separator_index + 1 :] if separator_index >= 0 else []
    if len(args) < 2:
        print(
            "usage: blender --background --factory-startup --python tests/blender/validate_addon.py -- "
            "<script_dir_root> <fixture1.lutchain> [fixture2.lutchain ...]"
        )
        return 2

    addon_parent = os.path.abspath(args[0])
    fixtures = [os.path.abspath(path) for path in args[1:]]
    lightness_modes = ["shader_to_rgb", "dot_nl"]
    bpy = _require_bpy()
    _register_addon(addon_parent)

    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    if bpy.app.version >= (5, 1, 0):
        lightness_modes.append("raycast")
    for fixture_path in fixtures:
        for lightness_mode in lightness_modes:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            _register_addon(addon_parent)
            bpy.context.scene.render.engine = "BLENDER_EEVEE"
            _configure_preferences(bpy, addon_parent, fixture_path, lightness_mode)
            result = bpy.ops.lutchainer.reload_script()
            if "FINISHED" not in result:
                raise AssertionError(f"{fixture_path}: reload_script did not finish successfully")
            _create_validation_object(bpy)
            result = bpy.ops.lutchainer.import_lutchain(filepath=fixture_path, lightness_mode=lightness_mode)
            if "FINISHED" not in result:
                raise AssertionError(f"{fixture_path}: import operator did not finish successfully for {lightness_mode}")
            _assert_pipeline_structure(bpy, fixture_path)
            result = bpy.ops.lutchainer.reload_and_reimport()
            if "FINISHED" not in result:
                raise AssertionError(f"{fixture_path}: reload_and_reimport did not finish successfully for {lightness_mode}")
            _assert_pipeline_structure(bpy, fixture_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
