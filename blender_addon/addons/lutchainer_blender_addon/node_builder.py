from __future__ import annotations

import os
import re
import tempfile
from typing import Any, Literal, Mapping, TypedDict, TypeVar, cast

import bpy

from .manifest import LutchainCustomParam, LutchainImportData, LutchainLut, LutchainStep

COLOR_INPUTS = [
    ("Base Color", "NodeSocketColor", "", False),
]
FLOAT_INPUTS = [
    "Lightness",
    "Specular",
    "HalfLambert",
    "Fresnel",
    "Facing",
    "NdotH",
    "LinearDepth",
]
VECTOR_INPUTS = [
    ("TexCoord", "NodeSocketVector", "", False),
]
STEP_INPUTS = [
    ("Current Color", "NodeSocketColor", "", False),
]
MIXRGB_BLEND_TYPES = {
    "replace": "MIX",
    "add": "ADD",
    "subtract": "SUBTRACT",
    "multiply": "MULTIPLY",
}
PARAM_TO_GROUP_INPUT = {
    "lightness": "Lightness",
    "specular": "Specular",
    "halfLambert": "HalfLambert",
    "fresnel": "Fresnel",
    "facing": "Facing",
    "nDotH": "NdotH",
    "linearDepth": "LinearDepth",
}
PARAMS_REQUIRING_TEXCOORD = {"texU", "texV"}
STEP_NODE_SPACING_X = 190
STEP_NODE_SPACING_Y = -190
PIPELINE_GROUP_INPUT_X = -260
PIPELINE_GROUP_FIRST_STEP_X = -20
STEP_GROUP_INPUT_X = -620
STEP_GROUP_OUTPUT_X = 760
LIGHTNESS_MODE_SHADER_TO_RGB = "shader_to_rgb"
LIGHTNESS_MODE_DOT_NL = "dot_nl"
LIGHTNESS_MODE_RAYCAST = "raycast"
BROWSER_DEFAULT_BASE_COLOR = (0.9, 0.9, 0.9, 1.0)
# Matches src/features/pipeline/pipeline-model.ts defaults:
# browser Y-up light dir for azimuth=0, elevation=50 is (0, sin(50deg), cos(50deg)).
# The compare camera/sample scripts convert browser (x, y, z) -> blender (x, -z, y),
# so the helper light position must follow the same mapping.
BROWSER_DEFAULT_LIGHT_POSITION = (0.0, -64.2787609, 76.6044443)
BROWSER_DEFAULT_SPECULAR_STRENGTH = 0.4
BROWSER_DEFAULT_SPECULAR_COLOR = (1.0, 1.0, 1.0, 1.0)
BROWSER_DEFAULT_SPECULAR_BASE_COLOR = (1.0, 1.0, 1.0, 1.0)
BROWSER_DEFAULT_SPECULAR_ROUGHNESS = 0.02
BROWSER_DEFAULT_SPECULAR_SHARPNESS = 6.0
BROWSER_DEFAULT_FRESNEL_STRENGTH = 0.18
BROWSER_DEFAULT_FRESNEL_IOR = 1.1
BROWSER_DEFAULT_FRESNEL_POWER = 2.2
HSV_ACHROMATIC_EPSILON = 1.0e-6

TNode = TypeVar("TNode")


class MaterialSettings(TypedDict):
    baseColor: tuple[float, float, float, float]
    specularStrength: float
    specularPower: float
    fresnelStrength: float
    fresnelPower: float


def _new_node(tree: bpy.types.NodeTree, node_id: str, node_type: type[TNode]) -> TNode:
    return cast(TNode, tree.nodes.new(node_id))


def _set_socket_default(socket: bpy.types.NodeSocket, value: object) -> None:
    setattr(socket, "default_value", value)


def _set_interface_socket_default(socket: bpy.types.NodeTreeInterfaceSocket, value: object) -> None:
    setattr(socket, "default_value", value)


def _set_interface_socket_range(socket: bpy.types.NodeTreeInterfaceSocket, min_value: float, max_value: float) -> None:
    setattr(socket, "min_value", min_value)
    setattr(socket, "max_value", max_value)


def _require_color_ramp(node: bpy.types.ShaderNodeValToRGB) -> bpy.types.ColorRamp:
    color_ramp = node.color_ramp
    if color_ramp is None:
        raise ValueError("Color ramp is unavailable")
    return color_ramp


def _set_color_ramp_element_color(element: bpy.types.ColorRampElement, color: tuple[float, float, float, float]) -> None:
    setattr(element, "color", color)


def _require_interface(tree: bpy.types.NodeTree) -> bpy.types.NodeTreeInterface:
    interface = tree.interface
    if interface is None:
        raise ValueError("Node tree interface is unavailable")
    return interface


def _resolve_material_settings(
    material_settings: Mapping[str, object] | None,
    *,
    base_color: tuple[float, float, float, float] | None = None,
) -> MaterialSettings:
    resolved_base_color = _resolve_base_color(base_color)
    settings: MaterialSettings = {
        "baseColor": resolved_base_color,
        "specularStrength": BROWSER_DEFAULT_SPECULAR_STRENGTH,
        "specularPower": 24.0,
        "fresnelStrength": BROWSER_DEFAULT_FRESNEL_STRENGTH,
        "fresnelPower": BROWSER_DEFAULT_FRESNEL_POWER,
    }
    if material_settings is None:
        return settings

    for key in ("specularStrength", "specularPower", "fresnelStrength", "fresnelPower"):
        value = material_settings.get(key)
        if isinstance(value, (int, float)):
            settings[key] = float(value)

    raw_base_color = material_settings.get("baseColor")
    if isinstance(raw_base_color, (tuple, list)) and len(raw_base_color) >= 3:
        settings["baseColor"] = (
            float(raw_base_color[0]),
            float(raw_base_color[1]),
            float(raw_base_color[2]),
            1.0,
        )
    return settings


def _specular_roughness_from_power(specular_power: float) -> float:
    safe_power = max(1.0, float(specular_power))
    return max(0.0, min(1.0, 2.0 / safe_power))


def _specular_sharpness_from_power(specular_power: float) -> float:
    safe_power = max(1.0, float(specular_power))
    return max(1.0, min(16.0, safe_power / 8.0))


def _sanitize_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_. -]+", "-", value).strip() or "LUTChain"


def _resolve_base_color(base_color: tuple[float, float, float, float] | None) -> tuple[float, float, float, float]:
    return base_color if base_color is not None else BROWSER_DEFAULT_BASE_COLOR


def _clear_nodes(tree: bpy.types.NodeTree) -> None:
    for node in list(tree.nodes):
        tree.nodes.remove(node)


def _new_interface_socket(
    tree: bpy.types.NodeTree,
    name: str,
    in_out: Literal["INPUT", "OUTPUT"],
    socket_type: str,
) -> bpy.types.NodeTreeInterfaceSocket:
    interface = _require_interface(tree)
    return cast(
        bpy.types.NodeTreeInterfaceSocket,
        interface.new_socket(name=name, in_out=in_out, socket_type=cast(Any, socket_type)),
    )


def _step_group_context_inputs(step: LutchainStep) -> list[tuple[str, str, str, bool]]:
    ordered_inputs: list[tuple[str, str, str, bool]] = []
    seen: set[str] = set()
    for param_name in (step.x_param, step.y_param):
        if param_name in PARAM_TO_GROUP_INPUT:
            input_name = PARAM_TO_GROUP_INPUT[param_name]
            if input_name not in seen:
                ordered_inputs.append((input_name, "NodeSocketFloat", "", False))
                seen.add(input_name)
        elif param_name in PARAMS_REQUIRING_TEXCOORD and "TexCoord" not in seen:
            ordered_inputs.append(("TexCoord", "NodeSocketVector", "", False))
            seen.add("TexCoord")
        elif param_name.startswith("custom:"):
            input_name = _custom_param_socket_name(param_name.split(":", 1)[1])
            if input_name not in seen:
                ordered_inputs.append((input_name, "NodeSocketFloat", "", False))
                seen.add(input_name)
    return ordered_inputs


def _custom_param_socket_name(param_id: str) -> str:
    return f"Param {param_id}"


def _configure_shader_group_interface(
    tree: bpy.types.ShaderNodeTree,
    is_step_group: bool,
    *,
    step: LutchainStep | None = None,
    custom_params: list[LutchainCustomParam] | None = None,
) -> None:
    custom_param_defaults = {
        _custom_param_socket_name(custom_param.id): custom_param.default_value
        for custom_param in (custom_params or [])
    }
    interface = _require_interface(tree)
    for item in list(interface.items_tree):
        interface.remove(item)

    if is_step_group:
        if step is None:
            raise ValueError("step group interface requires a step")
        inputs = STEP_INPUTS + _step_group_context_inputs(step)
    else:
        inputs = COLOR_INPUTS + [(name, "NodeSocketFloat", "", False) for name in FLOAT_INPUTS] + VECTOR_INPUTS
        if custom_params:
            inputs += [(_custom_param_socket_name(custom_param.id), "NodeSocketFloat", custom_param.label, True) for custom_param in custom_params]

    for name, socket_type, description, optional_label in inputs:
        socket = _new_interface_socket(tree, name, "INPUT", socket_type)
        socket.description = description
        socket.optional_label = optional_label
        if socket_type == "NodeSocketColor":
            _set_interface_socket_default(socket, (1.0, 1.0, 1.0, 1.0))
        elif socket_type == "NodeSocketFloat":
            _set_interface_socket_default(socket, custom_param_defaults.get(name, 0.0))
            _set_interface_socket_range(socket, 0.0, 8.0)
        elif socket_type == "NodeSocketVector":
            _set_interface_socket_default(socket, (0.0, 0.0, 0.0))

    _new_interface_socket(tree, "Color", "OUTPUT", "NodeSocketColor")


def _new_math(
    tree: bpy.types.NodeTree,
    operation: str,
    *,
    use_clamp: bool = False,
    location: tuple[float, float] = (0.0, 0.0),
) -> bpy.types.ShaderNodeMath:
    node = _new_node(tree, "ShaderNodeMath", bpy.types.ShaderNodeMath)
    node.operation = cast(Any, operation)
    node.use_clamp = use_clamp
    node.location = location
    return node


def _new_mixrgb(
    tree: bpy.types.NodeTree,
    blend_type: str,
    *,
    location: tuple[float, float] = (0.0, 0.0),
) -> bpy.types.ShaderNodeMixRGB:
    node = _new_node(tree, "ShaderNodeMixRGB", bpy.types.ShaderNodeMixRGB)
    node.blend_type = cast(Any, blend_type)
    node.use_clamp = True
    node.location = location
    return node


def _new_vector_math(
    tree: bpy.types.NodeTree,
    operation: str,
    *,
    location: tuple[float, float] = (0.0, 0.0),
) -> bpy.types.ShaderNodeVectorMath:
    node = _new_node(tree, "ShaderNodeVectorMath", bpy.types.ShaderNodeVectorMath)
    node.operation = cast(Any, operation)
    node.location = location
    return node


def _new_frame(
    tree: bpy.types.NodeTree,
    label: str,
    location: tuple[float, float] = (0.0, 0.0),
) -> bpy.types.NodeFrame:
    node = _new_node(tree, "NodeFrame", bpy.types.NodeFrame)
    node.label = label
    node.location = location
    return node


def _ensure_rgb_split(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    color_socket: bpy.types.NodeSocket,
    cache: dict[str, object],
    key: str,
    mode: str,
    location: tuple[float, float],
) -> bpy.types.ShaderNodeSeparateColor:
    node = cache.get(key)
    if isinstance(node, bpy.types.ShaderNodeSeparateColor):
        return node

    node = _new_node(tree, "ShaderNodeSeparateColor", bpy.types.ShaderNodeSeparateColor)
    node.mode = cast(Any, mode)
    node.location = location
    links.new(color_socket, node.inputs[0])
    cache[key] = node
    return node


def _ensure_xyz_split(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    vector_socket: bpy.types.NodeSocket,
    cache: dict[str, object],
    key: str,
    location: tuple[float, float],
) -> bpy.types.ShaderNodeSeparateXYZ:
    node = cache.get(key)
    if isinstance(node, bpy.types.ShaderNodeSeparateXYZ):
        return node

    node = _new_node(tree, "ShaderNodeSeparateXYZ", bpy.types.ShaderNodeSeparateXYZ)
    node.location = location
    links.new(vector_socket, node.inputs[0])
    cache[key] = node
    return node


def _float_lerp(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    from_socket: bpy.types.NodeSocket,
    to_socket: bpy.types.NodeSocket,
    factor_socket: bpy.types.NodeSocket,
    location: tuple[float, float],
) -> bpy.types.NodeSocket:
    inv = _new_math(tree, "SUBTRACT", use_clamp=True, location=location)
    _set_socket_default(inv.inputs[0], 1.0)
    links.new(factor_socket, inv.inputs[1])

    from_mul = _new_math(tree, "MULTIPLY", use_clamp=True, location=(location[0] + 180, location[1] + 60))
    to_mul = _new_math(tree, "MULTIPLY", use_clamp=True, location=(location[0] + 180, location[1] - 60))
    links.new(from_socket, from_mul.inputs[0])
    links.new(inv.outputs[0], from_mul.inputs[1])
    links.new(to_socket, to_mul.inputs[0])
    links.new(factor_socket, to_mul.inputs[1])

    add = _new_math(tree, "ADD", use_clamp=True, location=(location[0] + 360, location[1]))
    links.new(from_mul.outputs[0], add.inputs[0])
    links.new(to_mul.outputs[0], add.inputs[1])
    return add.outputs[0]


def _float_op(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    left_socket: bpy.types.NodeSocket,
    right_socket: bpy.types.NodeSocket,
    op: str,
    location: tuple[float, float],
) -> bpy.types.NodeSocket:
    if op == "none":
        return left_socket
    if op == "replace":
        return right_socket
    operation = {
        "add": "ADD",
        "subtract": "SUBTRACT",
        "multiply": "MULTIPLY",
    }.get(op)
    if operation is None:
        return left_socket
    node = _new_math(tree, operation, use_clamp=True, location=location)
    links.new(left_socket, node.inputs[0])
    links.new(right_socket, node.inputs[1])
    return node.outputs[0]


def _resolve_param_socket(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    group_input: bpy.types.NodeGroupInput,
    current_color_socket: bpy.types.NodeSocket,
    param_name: str,
    cache: dict[str, object],
) -> bpy.types.NodeSocket:
    if param_name in PARAM_TO_GROUP_INPUT:
        return group_input.outputs[PARAM_TO_GROUP_INPUT[param_name]]
    if param_name.startswith("custom:"):
        return group_input.outputs[_custom_param_socket_name(param_name.split(":", 1)[1])]

    if param_name in {"r", "g", "b"}:
        node = _ensure_rgb_split(
            tree,
            links,
            current_color_socket,
            cache,
            "current_rgb",
            "RGB",
            (-430, 170),
        )
        index = {"r": 0, "g": 1, "b": 2}[param_name]
        return node.outputs[index]

    if param_name in {"h", "s", "v"}:
        hsv = _ensure_rgb_split(
            tree,
            links,
            current_color_socket,
            cache,
            "current_hsv",
            "HSV",
            (-430, 20),
        )
        index = {"h": 0, "s": 1, "v": 2}[param_name]
        return hsv.outputs[index]

    if param_name in {"texU", "texV"}:
        node = _ensure_xyz_split(
            tree,
            links,
            group_input.outputs["TexCoord"],
            cache,
            "texcoord_xyz",
            (-430, -120),
        )
        index = 0 if param_name == "texU" else 1
        return node.outputs[index]

    if param_name == "zero":
        node = cache.get("const_zero")
        if not isinstance(node, bpy.types.ShaderNodeValue):
            node = _new_node(tree, "ShaderNodeValue", bpy.types.ShaderNodeValue)
            node.label = "Zero"
            _set_socket_default(node.outputs[0], 0.0)
            node.location = (-430, -220)
            cache["const_zero"] = node
        return node.outputs[0]

    if param_name == "one":
        node = cache.get("const_one")
        if not isinstance(node, bpy.types.ShaderNodeValue):
            node = _new_node(tree, "ShaderNodeValue", bpy.types.ShaderNodeValue)
            node.label = "One"
            _set_socket_default(node.outputs[0], 1.0)
            node.location = (-430, -300)
            cache["const_one"] = node
        return node.outputs[0]

    raise ValueError(f"Unsupported parameter '{param_name}'")


def _build_custom_rgb_target(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    current_color_socket: bpy.types.NodeSocket,
    lut_color_socket: bpy.types.NodeSocket,
    step: LutchainStep,
    node_pos: NodePosition,
) -> bpy.types.NodeSocket:
    current_rgb = _new_node(tree, "ShaderNodeSeparateColor", bpy.types.ShaderNodeSeparateColor)
    current_rgb.mode = "RGB"
    current_rgb.location = node_pos.next()
    links.new(current_color_socket, current_rgb.inputs[0])

    lut_rgb = _new_node(tree, "ShaderNodeSeparateColor", bpy.types.ShaderNodeSeparateColor)
    lut_rgb.mode = "RGB"
    lut_rgb.location = node_pos.next()
    links.new(lut_color_socket, lut_rgb.inputs[0])

    combine = _new_node(tree, "ShaderNodeCombineColor", bpy.types.ShaderNodeCombineColor)
    combine.mode = "RGB"
    combine.location = node_pos.next()

    for index, channel in enumerate(("r", "g", "b")):
        output_socket = _float_op(
            tree,
            links,
            current_rgb.outputs[index],
            lut_rgb.outputs[index],
            step.ops.get(channel, "none"),
            node_pos.next(),
        )
        links.new(output_socket, combine.inputs[index])
    return combine.outputs[0]


def _build_self_blend_target(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    current_color_socket: bpy.types.NodeSocket,
    lut_color_socket: bpy.types.NodeSocket,
    step: LutchainStep,
    node_pos: NodePosition,
) -> bpy.types.NodeSocket:
    current_rgb = _new_node(tree, "ShaderNodeSeparateColor", bpy.types.ShaderNodeSeparateColor)
    current_rgb.mode = "RGB"
    current_rgb.location = node_pos.next()
    links.new(current_color_socket, current_rgb.inputs[0])

    lut_rgb = _new_node(tree, "ShaderNodeSeparateColor", bpy.types.ShaderNodeSeparateColor)
    lut_rgb.mode = "RGB"
    lut_rgb.location = node_pos.next()
    links.new(lut_color_socket, lut_rgb.inputs[0])

    combine = _new_node(tree, "ShaderNodeCombineColor", bpy.types.ShaderNodeCombineColor)
    combine.mode = "RGB"
    combine.location = node_pos.next()

    for index, channel in enumerate(("r", "g", "b")):
        current_socket = current_rgb.outputs[index]
        op_socket = _float_op(
            tree,
            links,
            current_socket,
            current_socket,
            step.ops.get(channel, "none"),
            node_pos.next(),
        )
        target_socket = _float_lerp(
            tree,
            links,
            current_socket,
            op_socket,
            lut_rgb.outputs[index],
            node_pos.next(),
        )
        links.new(target_socket, combine.inputs[index])
    return combine.outputs[0]


def _build_custom_hsv_target(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    current_color_socket: bpy.types.NodeSocket,
    lut_color_socket: bpy.types.NodeSocket,
    step: LutchainStep,
    node_pos: NodePosition,
) -> bpy.types.NodeSocket:
    target_pos = NodePosition(node_pos.next())

    current_hsv = _new_node(tree, "ShaderNodeSeparateColor", bpy.types.ShaderNodeSeparateColor)
    current_hsv.mode = "HSV"
    current_hsv.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))
    links.new(current_color_socket, current_hsv.inputs[0])

    lut_hsv = _new_node(tree, "ShaderNodeSeparateColor", bpy.types.ShaderNodeSeparateColor)
    lut_hsv.mode = "HSV"
    lut_hsv.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))
    links.new(lut_color_socket, lut_hsv.inputs[0])

    combine = _new_node(tree, "ShaderNodeCombineColor", bpy.types.ShaderNodeCombineColor)
    combine.mode = "HSV"
    combine.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))

    delta = _new_math(tree, "MULTIPLY", use_clamp=False, location=target_pos.next(offset=(0, STEP_NODE_SPACING_Y)))
    links.new(current_hsv.outputs[1], delta.inputs[0])
    links.new(current_hsv.outputs[2], delta.inputs[1])

    has_chroma = _new_math(tree, "GREATER_THAN", use_clamp=False, location=target_pos.next(offset=(0, 0)))
    _set_socket_default(has_chroma.inputs[1], HSV_ACHROMATIC_EPSILON)
    links.new(delta.outputs[0], has_chroma.inputs[0])

    saturation_socket: bpy.types.NodeSocket | None = None
    for index, channel in enumerate(("h", "s", "v")):
        output_socket = _float_op(
            tree,
            links,
            current_hsv.outputs[index],
            lut_hsv.outputs[index],
            step.ops.get(channel, "none"),
            target_pos.next(),
        )
        if channel == "s":
            saturation_mask = _new_math(tree, "MULTIPLY", use_clamp=True, location=target_pos.next())
            links.new(output_socket, saturation_mask.inputs[0])
            links.new(has_chroma.outputs[0], saturation_mask.inputs[1])
            saturation_socket = saturation_mask.outputs[0]
            links.new(saturation_socket, combine.inputs[index])
        else:
            links.new(output_socket, combine.inputs[index])
    return combine.outputs[0]


def _build_hsv_layer_target(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    current_color_socket: bpy.types.NodeSocket,
    lut_color_socket: bpy.types.NodeSocket,
    *,
    use_hue: bool,
    use_saturation: bool,
    use_value: bool,
    node_pos: NodePosition,
) -> bpy.types.NodeSocket:
    target_pos = NodePosition(node_pos.next())
  
    current_hsv = _new_node(tree, "ShaderNodeSeparateColor", bpy.types.ShaderNodeSeparateColor)
    current_hsv.mode = "HSV"
    current_hsv.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))
    links.new(current_color_socket, current_hsv.inputs[0])

    lut_hsv = _new_node(tree, "ShaderNodeSeparateColor", bpy.types.ShaderNodeSeparateColor)
    lut_hsv.mode = "HSV"
    lut_hsv.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))
    links.new(lut_color_socket, lut_hsv.inputs[0])

    delta = _new_math(tree, "MULTIPLY", use_clamp=False, location=target_pos.next(offset=(0, STEP_NODE_SPACING_Y)))
    links.new(current_hsv.outputs[1], delta.inputs[0])
    links.new(current_hsv.outputs[2], delta.inputs[1])

    has_chroma = _new_math(tree, "GREATER_THAN", use_clamp=False, location=target_pos.next(offset=(0, STEP_NODE_SPACING_Y)))
    _set_socket_default(has_chroma.inputs[1], HSV_ACHROMATIC_EPSILON)
    links.new(delta.outputs[0], has_chroma.inputs[0])

    combine = _new_node(tree, "ShaderNodeCombineColor", bpy.types.ShaderNodeCombineColor)
    combine.mode = "HSV"
    combine.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))

    links.new(lut_hsv.outputs[0] if use_hue else current_hsv.outputs[0], combine.inputs[0])

    saturation_source = lut_hsv.outputs[1] if use_saturation else current_hsv.outputs[1]
    saturation_mask = _new_math(tree, "MULTIPLY", use_clamp=True, location=target_pos.next(offset=(0, STEP_NODE_SPACING_Y)))
    links.new(saturation_source, saturation_mask.inputs[0])
    links.new(has_chroma.outputs[0], saturation_mask.inputs[1])
    links.new(saturation_mask.outputs[0], combine.inputs[1])

    links.new(lut_hsv.outputs[2] if use_value else current_hsv.outputs[2], combine.inputs[2])
    return combine.outputs[0]


def _create_image_from_lut(lut: LutchainLut, import_name: str) -> bpy.types.Image:
    image_name = f"{_sanitize_name(import_name)}::{_sanitize_name(lut.name)}"
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as handle:
            handle.write(lut.png_bytes)
            temp_path = handle.name
        image = bpy.data.images.load(temp_path, check_existing=False)
        image.name = image_name
        colorspace_settings = image.colorspace_settings
        if colorspace_settings is not None:
            setattr(colorspace_settings, "name", "Non-Color")
        image.pack()
        return image
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


def _apply_step_mix(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    current_color_socket: bpy.types.NodeSocket,
    lut_color_socket: bpy.types.NodeSocket,
    lut_alpha_socket: bpy.types.NodeSocket,
    step: LutchainStep,
    node_pos: NodePosition,
) -> bpy.types.NodeSocket:
    if step.blend_mode == "none":
        return current_color_socket

    if step.blend_mode == "hue":
        target_color = _build_hsv_layer_target(
            tree,
            links,
            current_color_socket,
            lut_color_socket,
            use_hue=True,
            use_saturation=False,
            use_value=False,
            node_pos=node_pos,
        )
        node = _new_mixrgb(tree, "MIX", location=node_pos.next())
        links.new(lut_alpha_socket, node.inputs[0])
        links.new(current_color_socket, node.inputs[1])
        links.new(target_color, node.inputs[2])
        return node.outputs[0]

    if step.blend_mode == "saturation":
        target_color = _build_hsv_layer_target(
            tree,
            links,
            current_color_socket,
            lut_color_socket,
            use_hue=False,
            use_saturation=True,
            use_value=False,
            node_pos=node_pos,
        )
        node = _new_mixrgb(tree, "MIX", location=node_pos.next())
        links.new(lut_alpha_socket, node.inputs[0])
        links.new(current_color_socket, node.inputs[1])
        links.new(target_color, node.inputs[2])
        return node.outputs[0]

    if step.blend_mode == "color":
        target_color = _build_hsv_layer_target(
            tree,
            links,
            current_color_socket,
            lut_color_socket,
            use_hue=True,
            use_saturation=True,
            use_value=False,
            node_pos=node_pos,
        )
        node = _new_mixrgb(tree, "MIX", location=node_pos.next())
        links.new(lut_alpha_socket, node.inputs[0])
        links.new(current_color_socket, node.inputs[1])
        links.new(target_color, node.inputs[2])
        return node.outputs[0]

    if step.blend_mode == "value":
        target_color = _build_hsv_layer_target(
            tree,
            links,
            current_color_socket,
            lut_color_socket,
            use_hue=False,
            use_saturation=False,
            use_value=True,
            node_pos=node_pos,
        )
        node = _new_mixrgb(tree, "MIX", location=node_pos.next())
        links.new(lut_alpha_socket, node.inputs[0])
        links.new(current_color_socket, node.inputs[1])
        links.new(target_color, node.inputs[2])
        return node.outputs[0]

    if step.blend_mode in MIXRGB_BLEND_TYPES:
        node = _new_mixrgb(tree, MIXRGB_BLEND_TYPES[step.blend_mode], location=node_pos.next())
        links.new(lut_alpha_socket, node.inputs[0])
        links.new(current_color_socket, node.inputs[1])
        links.new(lut_color_socket, node.inputs[2])
        return node.outputs[0]

    if step.blend_mode == "customRgb":
        target_color = _build_custom_rgb_target(tree, links, current_color_socket, lut_color_socket, step, node_pos)
    elif step.blend_mode == "selfBlend":
        target_color = _build_self_blend_target(tree, links, current_color_socket, lut_color_socket, step, node_pos)
    elif step.blend_mode == "customHsv":
        target_color = _build_custom_hsv_target(tree, links, current_color_socket, lut_color_socket, step, node_pos)
    else:
        raise ValueError(f"Unsupported blend mode '{step.blend_mode}'")

    node = _new_mixrgb(tree, "MIX", location=node_pos.next())
    links.new(lut_alpha_socket, node.inputs[0])
    links.new(current_color_socket, node.inputs[1])
    links.new(target_color, node.inputs[2])
    return node.outputs[0]


def _build_step_group(
    import_name: str,
    step: LutchainStep,
    image: bpy.types.Image,
) -> bpy.types.ShaderNodeTree:
    step_name = step.label or f"Step {step.id}"
    tree = cast(bpy.types.ShaderNodeTree, bpy.data.node_groups.new(
        f"{_sanitize_name(import_name)} LC Step {_sanitize_name(step.id)}",
        "ShaderNodeTree",
    ))
    _configure_shader_group_interface(tree, is_step_group=True, step=step)
    tree["lutchainer_kind"] = "step"
    tree["lutchainer_step_id"] = step.id
    tree["lutchainer_step_label"] = step_name
    tree["lutchainer_blend_mode"] = step.blend_mode
    tree["lutchainer_x_param"] = step.x_param
    tree["lutchainer_y_param"] = step.y_param
    tree["lutchainer_muted"] = step.muted

    nodes = tree.nodes
    links = tree.links
    group_input = _new_node(tree, "NodeGroupInput", bpy.types.NodeGroupInput)
    group_input.location = (STEP_GROUP_INPUT_X, 0)
    group_output = _new_node(tree, "NodeGroupOutput", bpy.types.NodeGroupOutput)
    group_output.location = (STEP_GROUP_OUTPUT_X, 0)
    node_pos = NodePosition((-220, 0))
    sample_frame = _new_frame(tree, "LUT Sample", node_pos.get())

    if step.muted:
        links.new(group_input.outputs["Current Color"], group_output.inputs["Color"])
        return tree

    cache: dict[str, object] = {}
    x_socket = _resolve_param_socket(
        tree,
        links,
        group_input,
        group_input.outputs["Current Color"],
        step.x_param,
        cache,
    )
    y_socket = _resolve_param_socket(
        tree,
        links,
        group_input,
        group_input.outputs["Current Color"],
        step.y_param,
        cache,
    )

    combine_uv = _new_node(tree, "ShaderNodeCombineXYZ", bpy.types.ShaderNodeCombineXYZ)
    combine_uv.location = node_pos.next()
    combine_uv.parent = sample_frame
    links.new(x_socket, combine_uv.inputs[0])

    invert_v = _new_math(tree, "SUBTRACT", use_clamp=True, location=node_pos.next())
    invert_v.parent = sample_frame
    invert_v.label = "Invert V"
    _set_socket_default(invert_v.inputs[0], 1.0)
    links.new(y_socket, invert_v.inputs[1])
    links.new(invert_v.outputs[0], combine_uv.inputs[1])
    _set_socket_default(combine_uv.inputs[2], 0.0)

    image_node = _new_node(tree, "ShaderNodeTexImage", bpy.types.ShaderNodeTexImage)
    image_node.location = node_pos.next(offset=(320, 0))
    image_node.parent = sample_frame
    image_node.image = image
    image_node.interpolation = "Linear"
    image_node.extension = "EXTEND"
    links.new(combine_uv.outputs[0], image_node.inputs[0])

    result_socket = _apply_step_mix(
        tree,
        links,
        group_input.outputs["Current Color"],
        image_node.outputs["Color"],
        image_node.outputs["Alpha"],
        step,
        node_pos,
    )
    links.new(result_socket, group_output.inputs["Color"])
    return tree


def _build_pipeline_group(
    import_data: LutchainImportData,
    images_by_lut_id: dict[str, bpy.types.Image],
    filepath: str,
) -> bpy.types.ShaderNodeTree:
    tree = cast(bpy.types.ShaderNodeTree, bpy.data.node_groups.new(
        f"{_sanitize_name(import_data.display_name)} Lutchainer Pipeline",
        "ShaderNodeTree",
    ))
    _configure_shader_group_interface(tree, is_step_group=False, custom_params=import_data.custom_params)
    tree["lutchainer_kind"] = "pipeline"
    tree["lutchainer_source_filepath"] = filepath
    tree["lutchainer_version"] = import_data.version
    tree["lutchainer_custom_param_count"] = len(import_data.custom_params)

    nodes = tree.nodes
    links = tree.links
    group_input = _new_node(tree, "NodeGroupInput", bpy.types.NodeGroupInput)
    group_input.location = (PIPELINE_GROUP_INPUT_X, 0)
    group_output = _new_node(tree, "NodeGroupOutput", bpy.types.NodeGroupOutput)
    group_output.location = (PIPELINE_GROUP_FIRST_STEP_X + max(len(import_data.steps), 1) * STEP_NODE_SPACING_X + 200, 0)

    current_socket = group_input.outputs["Base Color"]
    current_x = PIPELINE_GROUP_FIRST_STEP_X
    for index, step in enumerate(import_data.steps):
        step_tree = _build_step_group(import_data.display_name, step, images_by_lut_id[step.lut_id])
        step_node = _new_node(tree, "ShaderNodeGroup", bpy.types.ShaderNodeGroup)
        step_node.node_tree = step_tree
        step_node.name = f"LC Step {index + 1:02d}"
        step_node.label = step.label or f"Step {index + 1}"
        step_node.location = (current_x, 0)
        step_node["lutchainer_kind"] = "step_node"
        step_node["lutchainer_step_index"] = index
        step_node["lutchainer_step_id"] = step.id
        step_node["lutchainer_blend_mode"] = step.blend_mode
        step_node["lutchainer_x_param"] = step.x_param
        step_node["lutchainer_y_param"] = step.y_param
        step_node["lutchainer_muted"] = step.muted

        links.new(current_socket, step_node.inputs["Current Color"])
        for input_name, _socket_type, _description, _optional_label in _step_group_context_inputs(step):
            links.new(group_input.outputs[input_name], step_node.inputs[input_name])
        current_socket = step_node.outputs["Color"]
        current_x += STEP_NODE_SPACING_X

    links.new(current_socket, group_output.inputs["Color"])
    return tree


def _build_helper_nodes(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    pipeline_node: bpy.types.ShaderNodeGroup,
    lightness_mode: str,
    *,
    base_color: tuple[float, float, float, float] | None = None,
    material_settings: Mapping[str, object] | None = None,
) -> None:
    resolved_material = _resolve_material_settings(material_settings, base_color=base_color)
    resolved_base_color = resolved_material["baseColor"]
    specular_strength = float(resolved_material["specularStrength"])
    specular_power = float(resolved_material["specularPower"])
    fresnel_strength = float(resolved_material["fresnelStrength"])
    fresnel_power = float(resolved_material["fresnelPower"])
    texcoord = _new_node(tree, "ShaderNodeTexCoord", bpy.types.ShaderNodeTexCoord)
    texcoord.location = (-1080, -150)
    links.new(texcoord.outputs["UV"], pipeline_node.inputs["TexCoord"])

    rgb = _new_node(tree, "ShaderNodeRGB", bpy.types.ShaderNodeRGB)
    rgb.location = (-880, 260)
    _set_socket_default(rgb.outputs[0], resolved_base_color)
    links.new(rgb.outputs[0], pipeline_node.inputs["Base Color"])

    fresnel = _new_node(tree, "ShaderNodeFresnel", bpy.types.ShaderNodeFresnel)
    fresnel.location = (-690, 130)
    _set_socket_default(fresnel.inputs["IOR"], BROWSER_DEFAULT_FRESNEL_IOR)
    fresnel_pow = _new_math(tree, "POWER", use_clamp=True, location=(-470, 130))
    _set_socket_default(fresnel_pow.inputs[1], fresnel_power)
    fresnel_mul = _new_math(tree, "MULTIPLY", use_clamp=True, location=(-250, 130))
    _set_socket_default(fresnel_mul.inputs[1], fresnel_strength)
    links.new(fresnel.outputs[0], fresnel_pow.inputs[0])
    links.new(fresnel_pow.outputs[0], fresnel_mul.inputs[0])
    links.new(fresnel_mul.outputs[0], pipeline_node.inputs["Fresnel"])

    facing_pos = NodePosition((-880, -20))
    facing_frame = _new_frame(tree, "Facing", facing_pos.get())
    layer_weight = _new_node(tree, "ShaderNodeLayerWeight", bpy.types.ShaderNodeLayerWeight)
    layer_weight.location = facing_pos.next()
    layer_weight.parent = facing_frame
    _set_socket_default(layer_weight.inputs["Blend"], 0.85)
    facing_invert = _new_math(tree, "SUBTRACT", use_clamp=True, location=facing_pos.next())
    facing_invert.parent = facing_frame
    _set_socket_default(facing_invert.inputs[0], 1.0)
    links.new(layer_weight.outputs["Facing"], facing_invert.inputs[1])
    links.new(facing_invert.outputs[0], pipeline_node.inputs["Facing"])

    lightness_pos = NodePosition((-880, -290))
    lightness_frame = _new_frame(tree, "Lightness", lightness_pos.get())

    if lightness_mode == LIGHTNESS_MODE_SHADER_TO_RGB:
        diffuse = _new_node(tree, "ShaderNodeBsdfDiffuse", bpy.types.ShaderNodeBsdfDiffuse)
        diffuse.location = lightness_pos.next()
        diffuse.parent = lightness_frame
        _set_socket_default(diffuse.inputs["Color"], (0.5, 0.5, 0.5, 1.0))
        diffuse_to_rgb = _new_node(tree, "ShaderNodeShaderToRGB", bpy.types.ShaderNodeShaderToRGB)
        diffuse_to_rgb.location = lightness_pos.next()
        diffuse_to_rgb.parent = lightness_frame
        diffuse_ramp = _new_node(tree, "ShaderNodeValToRGB", bpy.types.ShaderNodeValToRGB)
        diffuse_ramp.location = lightness_pos.next()
        diffuse_ramp.parent = lightness_frame
        diffuse_ramp.label = "Lambert Approx"
        diffuse_ramp_color_ramp = _require_color_ramp(diffuse_ramp)
        diffuse_ramp_color_ramp.interpolation = "EASE"
        diffuse_ramp_color_ramp.elements[0].position = 0.1
        _set_color_ramp_element_color(diffuse_ramp_color_ramp.elements[0], (0.0, 0.0, 0.0, 1.0))
        diffuse_ramp_color_ramp.elements[1].position = 0.5
        _set_color_ramp_element_color(diffuse_ramp_color_ramp.elements[1], (1.0, 1.0, 1.0, 1.0))
        links.new(diffuse.outputs[0], diffuse_to_rgb.inputs[0])
        links.new(diffuse_to_rgb.outputs[0], diffuse_ramp.inputs[0])
        lightness_socket = diffuse_ramp.outputs[0]
        half_lambert_source_socket = diffuse_to_rgb.outputs[0]
    else:
        light_position = _new_node(tree, "ShaderNodeCombineXYZ", bpy.types.ShaderNodeCombineXYZ)
        light_position.location = lightness_pos.next(offset_once=(0, -100))
        light_position.parent = lightness_frame
        light_position.label = "Light Position"
        _set_socket_default(light_position.inputs["X"], BROWSER_DEFAULT_LIGHT_POSITION[0])
        _set_socket_default(light_position.inputs["Y"], BROWSER_DEFAULT_LIGHT_POSITION[1])
        _set_socket_default(light_position.inputs["Z"], BROWSER_DEFAULT_LIGHT_POSITION[2])
        
        geometry = _new_node(tree, "ShaderNodeNewGeometry", bpy.types.ShaderNodeNewGeometry)
        geometry.location = lightness_pos.next()
        geometry.parent = lightness_frame

        origin_socket: bpy.types.NodeSocket = geometry.outputs["Position"]

        if lightness_mode == LIGHTNESS_MODE_RAYCAST:
            normal_offset = _new_vector_math(tree, "SCALE", location=lightness_pos.next())
            normal_offset.parent = lightness_frame
            _set_socket_default(normal_offset.inputs["Scale"], 0.001)
            links.new(geometry.outputs["Normal"], normal_offset.inputs[0])
            origin_add = _new_vector_math(tree, "ADD", location=lightness_pos.next())
            origin_add.parent = lightness_frame
            links.new(geometry.outputs["Position"], origin_add.inputs[0])
            links.new(normal_offset.outputs["Vector"], origin_add.inputs[1])
            origin_socket = origin_add.outputs["Vector"]

        to_light = _new_vector_math(tree, "SUBTRACT", location=lightness_pos.next())
        to_light.parent = lightness_frame
        links.new(light_position.outputs["Vector"], to_light.inputs[0])
        links.new(origin_socket, to_light.inputs[1])

        light_direction = _new_vector_math(tree, "NORMALIZE", location=lightness_pos.next())
        light_direction.parent = lightness_frame
        links.new(to_light.outputs["Vector"], light_direction.inputs[0])

        dot_nl = _new_vector_math(tree, "DOT_PRODUCT", location=lightness_pos.next())
        dot_nl.parent = lightness_frame
        links.new(geometry.outputs["Normal"], dot_nl.inputs[0])
        links.new(light_direction.outputs["Vector"], dot_nl.inputs[1])

        dot_nl_clamp = _new_math(tree, "MAXIMUM", use_clamp=True, location=lightness_pos.next())
        dot_nl_clamp.parent = lightness_frame
        _set_socket_default(dot_nl_clamp.inputs[1], 0.0)
        links.new(dot_nl.outputs["Value"], dot_nl_clamp.inputs[0])

        lightness_socket = dot_nl_clamp.outputs[0]
        half_lambert_source_socket = dot_nl.outputs["Value"]

        if lightness_mode == LIGHTNESS_MODE_RAYCAST:
            light_distance = _new_vector_math(tree, "LENGTH", location=lightness_pos.next())
            light_distance.parent = lightness_frame
            links.new(to_light.outputs["Vector"], light_distance.inputs[0])

            raycast = _new_node(tree, "ShaderNodeRaycast", bpy.types.ShaderNodeRaycast)
            raycast.location = lightness_pos.next()
            raycast.parent = lightness_frame
            links.new(origin_socket, raycast.inputs["Position"])
            links.new(light_direction.outputs["Vector"], raycast.inputs["Direction"])
            links.new(light_distance.outputs["Value"], raycast.inputs["Length"])

            hit_minus_self = _new_math(tree, "SUBTRACT", use_clamp=True, location=lightness_pos.next())
            hit_minus_self.parent = lightness_frame
            links.new(raycast.outputs["Is Hit"], hit_minus_self.inputs[0])
            links.new(raycast.outputs["Self Hit"], hit_minus_self.inputs[1])

            hit_clamp = _new_math(tree, "MAXIMUM", use_clamp=True, location=lightness_pos.next())
            hit_clamp.parent = lightness_frame
            _set_socket_default(hit_clamp.inputs[1], 0.0)
            links.new(hit_minus_self.outputs[0], hit_clamp.inputs[0])

            visibility = _new_math(tree, "SUBTRACT", use_clamp=True, location=lightness_pos.next())
            visibility.parent = lightness_frame
            _set_socket_default(visibility.inputs[0], 1.0)
            links.new(hit_clamp.outputs[0], visibility.inputs[1])

            shadowed_raw_dot = _new_math(tree, "MULTIPLY", use_clamp=False, location=lightness_pos.next())
            shadowed_raw_dot.parent = lightness_frame
            links.new(dot_nl.outputs["Value"], shadowed_raw_dot.inputs[0])
            links.new(visibility.outputs[0], shadowed_raw_dot.inputs[1])

            shadowed_dot_clamp = _new_math(tree, "MAXIMUM", use_clamp=True, location=lightness_pos.next())
            shadowed_dot_clamp.parent = lightness_frame
            _set_socket_default(shadowed_dot_clamp.inputs[1], 0.0)
            links.new(shadowed_raw_dot.outputs[0], shadowed_dot_clamp.inputs[0])

            lightness_socket = shadowed_dot_clamp.outputs[0]
            half_lambert_source_socket = shadowed_raw_dot.outputs[0]

    links.new(lightness_socket, pipeline_node.inputs["Lightness"])

    specular_pos = NodePosition((-880, -810))
    specular_frame = _new_frame(tree, "Specular", specular_pos.get())
    specular_bsdf = _new_node(tree, "ShaderNodeEeveeSpecular", bpy.types.ShaderNodeEeveeSpecular)
    specular_bsdf.location = specular_pos.next()
    specular_bsdf.parent = specular_frame
    # Browser-side specular is a scalar pow(NdotH, power) term, so the extracted
    # highlight should stay white instead of inheriting the material base color.
    _set_socket_default(specular_bsdf.inputs["Base Color"], BROWSER_DEFAULT_SPECULAR_BASE_COLOR)
    _set_socket_default(specular_bsdf.inputs["Specular"], BROWSER_DEFAULT_SPECULAR_COLOR)
    _set_socket_default(specular_bsdf.inputs["Roughness"], _specular_roughness_from_power(specular_power))
    specular_to_rgb = _new_node(tree, "ShaderNodeShaderToRGB", bpy.types.ShaderNodeShaderToRGB)
    specular_to_rgb.location = specular_pos.next()
    specular_to_rgb.parent = specular_frame
    specular_bw = _new_node(tree, "ShaderNodeRGBToBW", bpy.types.ShaderNodeRGBToBW)
    specular_bw.location = specular_pos.next()
    specular_bw.parent = specular_frame
    specular_pow = _new_math(tree, "POWER", use_clamp=True, location=specular_pos.next())
    specular_pow.parent = specular_frame
    _set_socket_default(specular_pow.inputs[1], _specular_sharpness_from_power(specular_power))
    specular_mul = _new_math(tree, "MULTIPLY", use_clamp=True, location=specular_pos.next())
    specular_mul.parent = specular_frame
    _set_socket_default(specular_mul.inputs[1], specular_strength)
    links.new(specular_bsdf.outputs[0], specular_to_rgb.inputs[0])
    links.new(specular_to_rgb.outputs[0], specular_bw.inputs[0])
    links.new(specular_bw.outputs[0], specular_pow.inputs[0])
    links.new(specular_pow.outputs[0], specular_mul.inputs[0])
    links.new(specular_mul.outputs[0], pipeline_node.inputs["Specular"])

    half_lambert_pos = NodePosition((-880, -590))
    half_lambert_frame = _new_frame(tree, "HalfLambert Approx", half_lambert_pos.get())
    half_mul = _new_math(tree, "MULTIPLY", use_clamp=False, location=half_lambert_pos.next())
    half_mul.parent = half_lambert_frame
    _set_socket_default(half_mul.inputs[1], 0.5)
    half_add = _new_math(tree, "ADD", use_clamp=False, location=half_lambert_pos.next())
    half_add.parent = half_lambert_frame
    _set_socket_default(half_add.inputs[1], 0.5)
    half_pow = _new_math(tree, "POWER", use_clamp=True, location=half_lambert_pos.next())
    half_pow.parent = half_lambert_frame
    _set_socket_default(half_pow.inputs[1], 2.0)
    links.new(half_lambert_source_socket, half_mul.inputs[0])
    links.new(half_mul.outputs[0], half_add.inputs[0])
    links.new(half_add.outputs[0], half_pow.inputs[0])
    links.new(half_pow.outputs[0], pipeline_node.inputs["HalfLambert"])


def _build_material_tree(
    material: bpy.types.Material,
    pipeline_group: bpy.types.ShaderNodeTree,
    *,
    lightness_mode: str,
    filepath: str,
    base_color: tuple[float, float, float, float] | None = None,
    material_settings: Mapping[str, object] | None = None,
) -> None:
    resolved_material = _resolve_material_settings(material_settings, base_color=base_color)
    resolved_base_color = resolved_material["baseColor"]
    material.use_nodes = True
    node_tree = material.node_tree
    if node_tree is None:
        raise ValueError("Material node tree is unavailable")
    _clear_nodes(node_tree)

    output = _new_node(node_tree, "ShaderNodeOutputMaterial", bpy.types.ShaderNodeOutputMaterial)
    output.location = (880, 0)
    emission = _new_node(node_tree, "ShaderNodeEmission", bpy.types.ShaderNodeEmission)
    emission.location = (620, 0)
    pipeline_node = _new_node(node_tree, "ShaderNodeGroup", bpy.types.ShaderNodeGroup)
    pipeline_node.node_tree = pipeline_group
    pipeline_node.location = (260, 20)
    pipeline_node.name = "Lutchainer Pipeline"
    pipeline_node.label = "Lutchainer Pipeline"
    pipeline_node["lutchainer_kind"] = "pipeline_node"
    pipeline_node["lutchainer_source_filepath"] = filepath

    _set_socket_default(pipeline_node.inputs["Base Color"], resolved_base_color)
    for input_name in FLOAT_INPUTS:
        _set_socket_default(pipeline_node.inputs[input_name], 0.0)
    _set_socket_default(pipeline_node.inputs["TexCoord"], (0.0, 0.0, 0.0))

    node_tree.links.new(pipeline_node.outputs["Color"], emission.inputs["Color"])
    node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])

    _build_helper_nodes(
        node_tree,
        node_tree.links,
        pipeline_node,
        lightness_mode,
        base_color=resolved_base_color,
        material_settings=resolved_material,
    )


def _assign_material_to_active_object(
    context: bpy.types.Context,
    material: bpy.types.Material,
) -> None:
    obj = getattr(context, "object", None)
    if obj is None or not hasattr(obj.data, "materials"):
        return

    if obj.active_material_index < len(obj.material_slots):
        obj.material_slots[obj.active_material_index].material = material
    elif obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)


def import_lutchain_material(
    *,
    context: bpy.types.Context,
    import_data: LutchainImportData,
    filepath: str,
    lightness_mode: str,
    base_color: tuple[float, float, float, float] | None = None,
    material_settings: dict[str, object] | None = None,
) -> bpy.types.Material:
    import_name = _sanitize_name(import_data.display_name)
    images_by_lut_id = {
        lut.id: _create_image_from_lut(lut, import_name)
        for lut in import_data.luts
    }
    pipeline_group = _build_pipeline_group(import_data, images_by_lut_id, filepath)
    material = bpy.data.materials.new(name=f"{import_name} Lutchainer Material")
    material["lutchainer_source_filepath"] = filepath
    material["lutchainer_version"] = import_data.version
    _build_material_tree(
        material,
        pipeline_group,
        lightness_mode=lightness_mode,
        filepath=filepath,
        base_color=base_color,
        material_settings=material_settings,
    )
    _assign_material_to_active_object(context, material)
    return material

class NodePosition:
    def __init__(self, pos: tuple[float, float]) -> None:
        self.x = pos[0]
        self.y = pos[1]

    def get(self) -> tuple[float, float]:
        return (self.x, self.y)

    def next(self, offset_once: tuple[float, float] = (0, 0), offset: tuple[float, float] = (STEP_NODE_SPACING_X, 0)) -> tuple[float, float]:
        pos = (self.x + offset_once[0], self.y + offset_once[1])
        self.x += offset[0]
        self.y += offset[1]
        return pos
