from __future__ import annotations

import os
import re
import tempfile

import bpy

from .manifest import LutchainImportData, LutchainLut, LutchainStep

COLOR_INPUTS = [
    ("Base Color", "NodeSocketColor"),
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
    ("TexCoord", "NodeSocketVector"),
]
STEP_INPUTS = [
    ("Current Color", "NodeSocketColor"),
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
BROWSER_DEFAULT_SPECULAR_COLOR = (0.4, 0.4, 0.4, 1.0)
BROWSER_DEFAULT_SPECULAR_ROUGHNESS = 0.08
BROWSER_DEFAULT_SPECULAR_SHARPNESS = 3.0
BROWSER_DEFAULT_FRESNEL_STRENGTH = 0.18
BROWSER_DEFAULT_FRESNEL_IOR = 1.1
BROWSER_DEFAULT_FRESNEL_POWER = 2.2
HSV_ACHROMATIC_EPSILON = 1.0e-6


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
    in_out: str,
    socket_type: str,
) -> bpy.types.NodeTreeInterfaceSocket:
    socket = tree.interface.new_socket(name=name, in_out=in_out, socket_type=socket_type)
    return socket


def _step_group_context_inputs(step: LutchainStep) -> list[tuple[str, str]]:
    ordered_inputs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for param_name in (step.x_param, step.y_param):
        if param_name in PARAM_TO_GROUP_INPUT:
            input_name = PARAM_TO_GROUP_INPUT[param_name]
            if input_name not in seen:
                ordered_inputs.append((input_name, "NodeSocketFloat"))
                seen.add(input_name)
        elif param_name in PARAMS_REQUIRING_TEXCOORD and "TexCoord" not in seen:
            ordered_inputs.append(("TexCoord", "NodeSocketVector"))
            seen.add("TexCoord")
    return ordered_inputs


def _configure_shader_group_interface(
    tree: bpy.types.ShaderNodeTree,
    is_step_group: bool,
    *,
    step: LutchainStep | None = None,
) -> None:
    for item in list(tree.interface.items_tree):
        tree.interface.remove(item)

    if is_step_group:
        if step is None:
            raise ValueError("step group interface requires a step")
        inputs = STEP_INPUTS + _step_group_context_inputs(step)
    else:
        inputs = COLOR_INPUTS + [(name, "NodeSocketFloat") for name in FLOAT_INPUTS] + VECTOR_INPUTS

    for name, socket_type in inputs:
        socket = _new_interface_socket(tree, name, "INPUT", socket_type)
        if socket_type == "NodeSocketColor":
            socket.default_value = (1.0, 1.0, 1.0, 1.0)
        elif socket_type == "NodeSocketFloat":
            socket.default_value = 0.0
            socket.min_value = 0.0
            socket.max_value = 8.0
        elif socket_type == "NodeSocketVector":
            socket.default_value = (0.0, 0.0, 0.0)

    _new_interface_socket(tree, "Color", "OUTPUT", "NodeSocketColor")


def _new_math(
    tree: bpy.types.NodeTree,
    operation: str,
    *,
    use_clamp: bool = False,
    location: tuple[float, float] = (0.0, 0.0),
) -> bpy.types.ShaderNodeMath:
    node = tree.nodes.new("ShaderNodeMath")
    node.operation = operation
    node.use_clamp = use_clamp
    node.location = location
    return node


def _new_mixrgb(
    tree: bpy.types.NodeTree,
    blend_type: str,
    *,
    location: tuple[float, float] = (0.0, 0.0),
) -> bpy.types.ShaderNodeMixRGB:
    node = tree.nodes.new("ShaderNodeMixRGB")
    node.blend_type = blend_type
    node.use_clamp = True
    node.location = location
    return node


def _new_vector_math(
    tree: bpy.types.NodeTree,
    operation: str,
    *,
    location: tuple[float, float] = (0.0, 0.0),
) -> bpy.types.ShaderNodeVectorMath:
    node = tree.nodes.new("ShaderNodeVectorMath")
    node.operation = operation
    node.location = location
    return node


def _new_frame(
    tree: bpy.types.NodeTree,
    label: str,
    location: tuple[float, float] = (0.0, 0.0),
) -> bpy.types.NodeFrame:
    node = tree.nodes.new("NodeFrame")
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

    node = tree.nodes.new("ShaderNodeSeparateColor")
    node.mode = mode
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

    node = tree.nodes.new("ShaderNodeSeparateXYZ")
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
    inv.inputs[0].default_value = 1.0
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
            node = tree.nodes.new("ShaderNodeValue")
            node.label = "Zero"
            node.outputs[0].default_value = 0.0
            node.location = (-430, -220)
            cache["const_zero"] = node
        return node.outputs[0]

    if param_name == "one":
        node = cache.get("const_one")
        if not isinstance(node, bpy.types.ShaderNodeValue):
            node = tree.nodes.new("ShaderNodeValue")
            node.label = "One"
            node.outputs[0].default_value = 1.0
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
    current_rgb = tree.nodes.new("ShaderNodeSeparateColor")
    current_rgb.mode = "RGB"
    current_rgb.location = node_pos.next()
    links.new(current_color_socket, current_rgb.inputs[0])

    lut_rgb = tree.nodes.new("ShaderNodeSeparateColor")
    lut_rgb.mode = "RGB"
    lut_rgb.location = node_pos.next()
    links.new(lut_color_socket, lut_rgb.inputs[0])

    combine = tree.nodes.new("ShaderNodeCombineColor")
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
    current_rgb = tree.nodes.new("ShaderNodeSeparateColor")
    current_rgb.mode = "RGB"
    current_rgb.location = node_pos.next()
    links.new(current_color_socket, current_rgb.inputs[0])

    lut_rgb = tree.nodes.new("ShaderNodeSeparateColor")
    lut_rgb.mode = "RGB"
    lut_rgb.location = node_pos.next()
    links.new(lut_color_socket, lut_rgb.inputs[0])

    combine = tree.nodes.new("ShaderNodeCombineColor")
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

    current_hsv = tree.nodes.new("ShaderNodeSeparateColor")
    current_hsv.mode = "HSV"
    current_hsv.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))
    links.new(current_color_socket, current_hsv.inputs[0])

    lut_hsv = tree.nodes.new("ShaderNodeSeparateColor")
    lut_hsv.mode = "HSV"
    lut_hsv.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))
    links.new(lut_color_socket, lut_hsv.inputs[0])

    combine = tree.nodes.new("ShaderNodeCombineColor")
    combine.mode = "HSV"
    combine.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))

    delta = _new_math(tree, "MULTIPLY", use_clamp=False, location=target_pos.next(offset=(0, STEP_NODE_SPACING_Y)))
    links.new(current_hsv.outputs[1], delta.inputs[0])
    links.new(current_hsv.outputs[2], delta.inputs[1])

    has_chroma = _new_math(tree, "GREATER_THAN", use_clamp=False, location=target_pos.next(offset=(0, 0)))
    has_chroma.inputs[1].default_value = HSV_ACHROMATIC_EPSILON
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
  
    current_hsv = tree.nodes.new("ShaderNodeSeparateColor")
    current_hsv.mode = "HSV"
    current_hsv.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))
    links.new(current_color_socket, current_hsv.inputs[0])

    lut_hsv = tree.nodes.new("ShaderNodeSeparateColor")
    lut_hsv.mode = "HSV"
    lut_hsv.location = target_pos.next(offset=(0, STEP_NODE_SPACING_Y))
    links.new(lut_color_socket, lut_hsv.inputs[0])

    delta = _new_math(tree, "MULTIPLY", use_clamp=False, location=target_pos.next(offset=(0, STEP_NODE_SPACING_Y)))
    links.new(current_hsv.outputs[1], delta.inputs[0])
    links.new(current_hsv.outputs[2], delta.inputs[1])

    has_chroma = _new_math(tree, "GREATER_THAN", use_clamp=False, location=target_pos.next(offset=(0, STEP_NODE_SPACING_Y)))
    has_chroma.inputs[1].default_value = HSV_ACHROMATIC_EPSILON
    links.new(delta.outputs[0], has_chroma.inputs[0])

    combine = tree.nodes.new("ShaderNodeCombineColor")
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
        if hasattr(image, "colorspace_settings"):
            image.colorspace_settings.name = "Non-Color"
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
    tree = bpy.data.node_groups.new(
        f"{_sanitize_name(import_name)} LC Step {step.id:02d}",
        "ShaderNodeTree",
    )
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
    group_input = nodes.new("NodeGroupInput")
    group_input.location = (STEP_GROUP_INPUT_X, 0)
    group_output = nodes.new("NodeGroupOutput")
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

    combine_uv = nodes.new("ShaderNodeCombineXYZ")
    combine_uv.location = node_pos.next()
    combine_uv.parent = sample_frame
    links.new(x_socket, combine_uv.inputs[0])

    invert_v = _new_math(tree, "SUBTRACT", use_clamp=True, location=node_pos.next())
    invert_v.parent = sample_frame
    invert_v.label = "Invert V"
    invert_v.inputs[0].default_value = 1.0
    links.new(y_socket, invert_v.inputs[1])
    links.new(invert_v.outputs[0], combine_uv.inputs[1])
    combine_uv.inputs[2].default_value = 0.0

    image_node = nodes.new("ShaderNodeTexImage")
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
    tree = bpy.data.node_groups.new(
        f"{_sanitize_name(import_data.display_name)} Lutchainer Pipeline",
        "ShaderNodeTree",
    )
    _configure_shader_group_interface(tree, is_step_group=False)
    tree["lutchainer_kind"] = "pipeline"
    tree["lutchainer_source_filepath"] = filepath
    tree["lutchainer_version"] = import_data.version
    tree["lutchainer_next_step_id"] = import_data.next_step_id

    nodes = tree.nodes
    links = tree.links
    group_input = nodes.new("NodeGroupInput")
    group_input.location = (PIPELINE_GROUP_INPUT_X, 0)
    group_output = nodes.new("NodeGroupOutput")
    group_output.location = (PIPELINE_GROUP_FIRST_STEP_X + max(len(import_data.steps), 1) * STEP_NODE_SPACING_X + 200, 0)

    current_socket = group_input.outputs["Base Color"]
    current_x = PIPELINE_GROUP_FIRST_STEP_X
    for index, step in enumerate(import_data.steps):
        step_tree = _build_step_group(import_data.display_name, step, images_by_lut_id[step.lut_id])
        step_node = nodes.new("ShaderNodeGroup")
        step_node.node_tree = step_tree
        step_node.name = f"LC Step {index + 1:02d}"
        step_node.label = step.label or step_node.name
        step_node.location = (current_x, 0)
        step_node["lutchainer_kind"] = "step_node"
        step_node["lutchainer_step_index"] = index
        step_node["lutchainer_step_id"] = step.id
        step_node["lutchainer_blend_mode"] = step.blend_mode
        step_node["lutchainer_x_param"] = step.x_param
        step_node["lutchainer_y_param"] = step.y_param
        step_node["lutchainer_muted"] = step.muted

        links.new(current_socket, step_node.inputs["Current Color"])
        for input_name, _socket_type in _step_group_context_inputs(step):
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
) -> None:
    resolved_base_color = _resolve_base_color(base_color)
    texcoord = tree.nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-1080, -150)
    links.new(texcoord.outputs["UV"], pipeline_node.inputs["TexCoord"])

    rgb = tree.nodes.new("ShaderNodeRGB")
    rgb.location = (-880, 260)
    rgb.outputs[0].default_value = resolved_base_color
    links.new(rgb.outputs[0], pipeline_node.inputs["Base Color"])

    fresnel = tree.nodes.new("ShaderNodeFresnel")
    fresnel.location = (-690, 130)
    fresnel.inputs["IOR"].default_value = BROWSER_DEFAULT_FRESNEL_IOR
    fresnel_pow = _new_math(tree, "POWER", use_clamp=True, location=(-470, 130))
    fresnel_pow.inputs[1].default_value = BROWSER_DEFAULT_FRESNEL_POWER
    fresnel_mul = _new_math(tree, "MULTIPLY", use_clamp=True, location=(-250, 130))
    fresnel_mul.inputs[1].default_value = BROWSER_DEFAULT_FRESNEL_STRENGTH
    links.new(fresnel.outputs[0], fresnel_pow.inputs[0])
    links.new(fresnel_pow.outputs[0], fresnel_mul.inputs[0])
    links.new(fresnel_mul.outputs[0], pipeline_node.inputs["Fresnel"])

    facing_pos = NodePosition((-880, -20))
    facing_frame = _new_frame(tree, "Facing", facing_pos.get())
    layer_weight = tree.nodes.new("ShaderNodeLayerWeight")
    layer_weight.location = facing_pos.next()
    layer_weight.parent = facing_frame
    layer_weight.inputs["Blend"].default_value = 0.85
    facing_invert = _new_math(tree, "SUBTRACT", use_clamp=True, location=facing_pos.next())
    facing_invert.parent = facing_frame
    facing_invert.inputs[0].default_value = 1.0
    links.new(layer_weight.outputs["Facing"], facing_invert.inputs[1])
    links.new(facing_invert.outputs[0], pipeline_node.inputs["Facing"])

    lightness_pos = NodePosition((-880, -290))
    lightness_frame = _new_frame(tree, "Lightness", lightness_pos.get())

    geometry = tree.nodes.new("ShaderNodeNewGeometry")
    geometry.location = lightness_pos.next()
    geometry.parent = lightness_frame
    light_position = tree.nodes.new("ShaderNodeCombineXYZ")
    light_position.location = lightness_pos.next(offset_once=(0, -100))
    light_position.parent = lightness_frame
    light_position.label = "Light Position"
    light_position.inputs["X"].default_value = BROWSER_DEFAULT_LIGHT_POSITION[0]
    light_position.inputs["Y"].default_value = BROWSER_DEFAULT_LIGHT_POSITION[1]
    light_position.inputs["Z"].default_value = BROWSER_DEFAULT_LIGHT_POSITION[2]

    if lightness_mode == LIGHTNESS_MODE_SHADER_TO_RGB:
        diffuse = tree.nodes.new("ShaderNodeBsdfDiffuse")
        diffuse.location = lightness_pos.next()
        diffuse.parent = lightness_frame
        diffuse.inputs["Color"].default_value = (0.5, 0.5, 0.5, 1.0)
        diffuse_to_rgb = tree.nodes.new("ShaderNodeShaderToRGB")
        diffuse_to_rgb.location = lightness_pos.next()
        diffuse_to_rgb.parent = lightness_frame
        diffuse_ramp = tree.nodes.new("ShaderNodeValToRGB")
        diffuse_ramp.location = lightness_pos.next()
        diffuse_ramp.parent = lightness_frame
        diffuse_ramp.label = "Lambert Approx"
        diffuse_ramp.color_ramp.interpolation = "EASE"
        diffuse_ramp.color_ramp.elements[0].position = 0.1
        diffuse_ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
        diffuse_ramp.color_ramp.elements[1].position = 0.5
        diffuse_ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
        links.new(diffuse.outputs[0], diffuse_to_rgb.inputs[0])
        links.new(diffuse_to_rgb.outputs[0], diffuse_ramp.inputs[0])
        lightness_socket = diffuse_ramp.outputs[0]
        half_lambert_source_socket = diffuse_to_rgb.outputs[0]
    else:
        origin_socket: bpy.types.NodeSocket = geometry.outputs["Position"]

        if lightness_mode == LIGHTNESS_MODE_RAYCAST:
            normal_offset = _new_vector_math(tree, "SCALE", location=lightness_pos.next())
            normal_offset.parent = lightness_frame
            normal_offset.inputs["Scale"].default_value = 0.001
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
        dot_nl_clamp.inputs[1].default_value = 0.0
        links.new(dot_nl.outputs["Value"], dot_nl_clamp.inputs[0])

        lightness_socket = dot_nl_clamp.outputs[0]
        half_lambert_source_socket = dot_nl.outputs["Value"]

        if lightness_mode == LIGHTNESS_MODE_RAYCAST:
            light_distance = _new_vector_math(tree, "LENGTH", location=lightness_pos.next())
            light_distance.parent = lightness_frame
            links.new(to_light.outputs["Vector"], light_distance.inputs[0])

            raycast = tree.nodes.new("ShaderNodeRaycast")
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
            hit_clamp.inputs[1].default_value = 0.0
            links.new(hit_minus_self.outputs[0], hit_clamp.inputs[0])

            visibility = _new_math(tree, "SUBTRACT", use_clamp=True, location=lightness_pos.next())
            visibility.parent = lightness_frame
            visibility.inputs[0].default_value = 1.0
            links.new(hit_clamp.outputs[0], visibility.inputs[1])

            shadowed_raw_dot = _new_math(tree, "MULTIPLY", use_clamp=False, location=lightness_pos.next())
            shadowed_raw_dot.parent = lightness_frame
            links.new(dot_nl.outputs["Value"], shadowed_raw_dot.inputs[0])
            links.new(visibility.outputs[0], shadowed_raw_dot.inputs[1])

            shadowed_dot_clamp = _new_math(tree, "MAXIMUM", use_clamp=True, location=lightness_pos.next())
            shadowed_dot_clamp.parent = lightness_frame
            shadowed_dot_clamp.inputs[1].default_value = 0.0
            links.new(shadowed_raw_dot.outputs[0], shadowed_dot_clamp.inputs[0])

            lightness_socket = shadowed_dot_clamp.outputs[0]
            half_lambert_source_socket = shadowed_raw_dot.outputs[0]

    links.new(lightness_socket, pipeline_node.inputs["Lightness"])

    specular_pos = NodePosition((-880, -780))
    specular_frame = _new_frame(tree, "Specular", specular_pos.get())
    specular_bsdf = tree.nodes.new("ShaderNodeEeveeSpecular")
    specular_bsdf.location = specular_pos.next()
    specular_bsdf.parent = specular_frame
    specular_bsdf.inputs["Base Color"].default_value = resolved_base_color
    specular_bsdf.inputs["Specular"].default_value = BROWSER_DEFAULT_SPECULAR_COLOR
    specular_bsdf.inputs["Roughness"].default_value = BROWSER_DEFAULT_SPECULAR_ROUGHNESS
    specular_to_rgb = tree.nodes.new("ShaderNodeShaderToRGB")
    specular_to_rgb.location = specular_pos.next()
    specular_to_rgb.parent = specular_frame
    specular_bw = tree.nodes.new("ShaderNodeRGBToBW")
    specular_bw.location = specular_pos.next()
    specular_bw.parent = specular_frame
    specular_pow = _new_math(tree, "POWER", use_clamp=True, location=specular_pos.next())
    specular_pow.parent = specular_frame
    specular_pow.inputs[1].default_value = BROWSER_DEFAULT_SPECULAR_SHARPNESS
    specular_mul = _new_math(tree, "MULTIPLY", use_clamp=True, location=specular_pos.next())
    specular_mul.parent = specular_frame
    specular_mul.inputs[1].default_value = BROWSER_DEFAULT_SPECULAR_STRENGTH
    links.new(specular_bsdf.outputs[0], specular_to_rgb.inputs[0])
    links.new(specular_to_rgb.outputs[0], specular_bw.inputs[0])
    links.new(specular_bw.outputs[0], specular_pow.inputs[0])
    links.new(specular_pow.outputs[0], specular_mul.inputs[0])
    links.new(specular_mul.outputs[0], pipeline_node.inputs["Specular"])

    half_lambert_frame = _new_frame(tree, "HalfLambert", (-900, -550))
    half_mul = _new_math(tree, "MULTIPLY", use_clamp=False, location=(-880, -560))
    half_mul.parent = half_lambert_frame
    half_mul.inputs[1].default_value = 0.5
    half_add = _new_math(tree, "ADD", use_clamp=False, location=(-660, -560))
    half_add.parent = half_lambert_frame
    half_add.inputs[1].default_value = 0.5
    half_pow = _new_math(tree, "POWER", use_clamp=True, location=(-440, -560))
    half_pow.parent = half_lambert_frame
    half_pow.inputs[1].default_value = 2.0
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
) -> None:
    resolved_base_color = _resolve_base_color(base_color)
    material.use_nodes = True
    node_tree = material.node_tree
    _clear_nodes(node_tree)

    output = node_tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (880, 0)
    emission = node_tree.nodes.new("ShaderNodeEmission")
    emission.location = (620, 0)
    pipeline_node = node_tree.nodes.new("ShaderNodeGroup")
    pipeline_node.node_tree = pipeline_group
    pipeline_node.location = (260, 20)
    pipeline_node.name = "Lutchainer Pipeline"
    pipeline_node.label = "Lutchainer Pipeline"
    pipeline_node["lutchainer_kind"] = "pipeline_node"
    pipeline_node["lutchainer_source_filepath"] = filepath

    pipeline_node.inputs["Base Color"].default_value = resolved_base_color
    for input_name in FLOAT_INPUTS:
        pipeline_node.inputs[input_name].default_value = 0.0
    pipeline_node.inputs["TexCoord"].default_value = (0.0, 0.0, 0.0)

    node_tree.links.new(pipeline_node.outputs["Color"], emission.inputs["Color"])
    node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])

    _build_helper_nodes(
        node_tree,
        node_tree.links,
        pipeline_node,
        lightness_mode,
        base_color=resolved_base_color,
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
    )
    _assign_material_to_active_object(context, material)
    return material

class NodePosition:
    def __init__(self, pos: tuple[float, float]) -> None:
        self.x = pos[0]
        self.y = pos[1]

    def get(self) -> (float, float):
        return (self.x, self.y)

    def next(self, offset_once: tuple[float, float] = (0, 0), offset: tuple[float, float] = (STEP_NODE_SPACING_X, 0)) -> (float, float):
        pos = (self.x + offset_once[0], self.y + offset_once[1])
        self.x += offset[0]
        self.y += offset[1]
        return pos