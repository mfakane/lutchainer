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
    "hue": "HUE",
    "saturation": "SATURATION",
    "color": "COLOR",
    "value": "VALUE",
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
PIPELINE_GROUP_INPUT_X = -260
PIPELINE_GROUP_FIRST_STEP_X = -20
STEP_GROUP_INPUT_X = -620
STEP_GROUP_OUTPUT_X = 760


def _sanitize_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_. -]+", "-", value).strip() or "LUTChain"


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
        node = _ensure_rgb_split(
            tree,
            links,
            current_color_socket,
            cache,
            "current_hsv",
            "HSV",
            (-430, 20),
        )
        index = {"h": 0, "s": 1, "v": 2}[param_name]
        return node.outputs[index]

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
) -> bpy.types.NodeSocket:
    current_rgb = tree.nodes.new("ShaderNodeSeparateColor")
    current_rgb.mode = "RGB"
    current_rgb.location = (-120, 170)
    links.new(current_color_socket, current_rgb.inputs[0])

    lut_rgb = tree.nodes.new("ShaderNodeSeparateColor")
    lut_rgb.mode = "RGB"
    lut_rgb.location = (-120, 20)
    links.new(lut_color_socket, lut_rgb.inputs[0])

    combine = tree.nodes.new("ShaderNodeCombineColor")
    combine.mode = "RGB"
    combine.location = (290, 95)

    for index, channel in enumerate(("r", "g", "b")):
        output_socket = _float_op(
            tree,
            links,
            current_rgb.outputs[index],
            lut_rgb.outputs[index],
            step.ops.get(channel, "none"),
            (50, 160 - index * 90),
        )
        links.new(output_socket, combine.inputs[index])
    return combine.outputs[0]


def _build_self_blend_target(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    current_color_socket: bpy.types.NodeSocket,
    lut_color_socket: bpy.types.NodeSocket,
    step: LutchainStep,
) -> bpy.types.NodeSocket:
    current_rgb = tree.nodes.new("ShaderNodeSeparateColor")
    current_rgb.mode = "RGB"
    current_rgb.location = (-120, 190)
    links.new(current_color_socket, current_rgb.inputs[0])

    lut_rgb = tree.nodes.new("ShaderNodeSeparateColor")
    lut_rgb.mode = "RGB"
    lut_rgb.location = (-120, 20)
    links.new(lut_color_socket, lut_rgb.inputs[0])

    combine = tree.nodes.new("ShaderNodeCombineColor")
    combine.mode = "RGB"
    combine.location = (520, 110)

    for index, channel in enumerate(("r", "g", "b")):
        current_socket = current_rgb.outputs[index]
        op_socket = _float_op(
            tree,
            links,
            current_socket,
            current_socket,
            step.ops.get(channel, "none"),
            (20, 180 - index * 120),
        )
        target_socket = _float_lerp(
            tree,
            links,
            current_socket,
            op_socket,
            lut_rgb.outputs[index],
            (210, 180 - index * 120),
        )
        links.new(target_socket, combine.inputs[index])
    return combine.outputs[0]


def _build_custom_hsv_target(
    tree: bpy.types.NodeTree,
    links: bpy.types.NodeLinks,
    current_color_socket: bpy.types.NodeSocket,
    lut_color_socket: bpy.types.NodeSocket,
    step: LutchainStep,
) -> bpy.types.NodeSocket:
    current_hsv = tree.nodes.new("ShaderNodeSeparateColor")
    current_hsv.mode = "HSV"
    current_hsv.location = (-120, 170)
    links.new(current_color_socket, current_hsv.inputs[0])

    lut_hsv = tree.nodes.new("ShaderNodeSeparateColor")
    lut_hsv.mode = "HSV"
    lut_hsv.location = (-120, 20)
    links.new(lut_color_socket, lut_hsv.inputs[0])

    combine = tree.nodes.new("ShaderNodeCombineColor")
    combine.mode = "HSV"
    combine.location = (290, 95)

    for index, channel in enumerate(("h", "s", "v")):
        output_socket = _float_op(
            tree,
            links,
            current_hsv.outputs[index],
            lut_hsv.outputs[index],
            step.ops.get(channel, "none"),
            (50, 160 - index * 90),
        )
        links.new(output_socket, combine.inputs[index])
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
) -> bpy.types.NodeSocket:
    if step.blend_mode == "none":
        return current_color_socket

    if step.blend_mode in MIXRGB_BLEND_TYPES:
        node = _new_mixrgb(tree, MIXRGB_BLEND_TYPES[step.blend_mode], location=(420, 40))
        links.new(lut_alpha_socket, node.inputs[0])
        links.new(current_color_socket, node.inputs[1])
        links.new(lut_color_socket, node.inputs[2])
        return node.outputs[0]

    if step.blend_mode == "customRgb":
        target_color = _build_custom_rgb_target(tree, links, current_color_socket, lut_color_socket, step)
    elif step.blend_mode == "selfBlend":
        target_color = _build_self_blend_target(tree, links, current_color_socket, lut_color_socket, step)
    elif step.blend_mode == "customHsv":
        target_color = _build_custom_hsv_target(tree, links, current_color_socket, lut_color_socket, step)
    else:
        raise ValueError(f"Unsupported blend mode '{step.blend_mode}'")

    node = _new_mixrgb(tree, "MIX", location=(620, 40))
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
    sample_frame = _new_frame(tree, "LUT Sample", (-190, 90))

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
    combine_uv.location = (-120, 35)
    combine_uv.parent = sample_frame
    links.new(x_socket, combine_uv.inputs[0])
    links.new(y_socket, combine_uv.inputs[1])
    combine_uv.inputs[2].default_value = 0.0

    image_node = nodes.new("ShaderNodeTexImage")
    image_node.location = (90, 35)
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
) -> None:
    texcoord = tree.nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-220, -800)
    links.new(texcoord.outputs["UV"], pipeline_node.inputs["TexCoord"])

    rgb = tree.nodes.new("ShaderNodeRGB")
    rgb.location = (-880, 260)
    rgb.outputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    links.new(rgb.outputs[0], pipeline_node.inputs["Base Color"])

    fresnel = tree.nodes.new("ShaderNodeFresnel")
    fresnel.location = (-640, 130)
    fresnel.inputs["IOR"].default_value = 1.1
    links.new(fresnel.outputs[0], pipeline_node.inputs["Fresnel"])

    facing_frame = _new_frame(tree, "Facing", (-900, -60))
    layer_weight = tree.nodes.new("ShaderNodeLayerWeight")
    layer_weight.location = (-880, -20)
    layer_weight.parent = facing_frame
    layer_weight.inputs["Blend"].default_value = 0.85
    facing_invert = _new_math(tree, "SUBTRACT", use_clamp=True, location=(-640, -20))
    facing_invert.parent = facing_frame
    facing_invert.inputs[0].default_value = 1.0
    links.new(layer_weight.outputs["Facing"], facing_invert.inputs[1])
    links.new(facing_invert.outputs[0], pipeline_node.inputs["Facing"])

    lightness_frame = _new_frame(tree, "Lightness", (-900, -330))
    diffuse = tree.nodes.new("ShaderNodeBsdfDiffuse")
    diffuse.location = (-880, -260)
    diffuse.parent = lightness_frame
    diffuse.inputs["Color"].default_value = (0.5, 0.5, 0.5, 1.0)
    diffuse_to_rgb = tree.nodes.new("ShaderNodeShaderToRGB")
    diffuse_to_rgb.location = (-640, -260)
    diffuse_to_rgb.parent = lightness_frame
    diffuse_ramp = tree.nodes.new("ShaderNodeValToRGB")
    diffuse_ramp.location = (-400, -260)
    diffuse_ramp.parent = lightness_frame
    diffuse_ramp.label = "Lambert Approx"
    diffuse_ramp.color_ramp.interpolation = "EASE"
    diffuse_ramp.color_ramp.elements[0].position = 0.1
    diffuse_ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    diffuse_ramp.color_ramp.elements[1].position = 0.5
    diffuse_ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
    links.new(diffuse.outputs[0], diffuse_to_rgb.inputs[0])
    links.new(diffuse_to_rgb.outputs[0], diffuse_ramp.inputs[0])
    links.new(diffuse_ramp.outputs[0], pipeline_node.inputs["Lightness"])

    specular_frame = _new_frame(tree, "Specular", (-900, -780))
    glossy = tree.nodes.new("ShaderNodeBsdfGlossy")
    glossy.location = (-880, -800)
    glossy.parent = specular_frame
    glossy.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    glossy_to_rgb = tree.nodes.new("ShaderNodeShaderToRGB")
    glossy_to_rgb.location = (-640, -800)
    glossy_to_rgb.parent = specular_frame
    links.new(glossy.outputs[0], glossy_to_rgb.inputs[0])
    links.new(glossy_to_rgb.outputs[0], pipeline_node.inputs["Specular"])

    half_lambert_frame = _new_frame(tree, "HalfLambert", (-900, -550))
    half_mul = _new_math(tree, "MULTIPLY", use_clamp=True, location=(-880, -560))
    half_mul.parent = half_lambert_frame
    half_mul.inputs[1].default_value = 0.5
    half_add = _new_math(tree, "ADD", use_clamp=True, location=(-660, -560))
    half_add.parent = half_lambert_frame
    half_add.inputs[1].default_value = 0.5
    half_pow = _new_math(tree, "POWER", use_clamp=True, location=(-440, -560))
    half_pow.parent = half_lambert_frame
    half_pow.inputs[1].default_value = 2.0
    links.new(diffuse_ramp.outputs[0], half_mul.inputs[0])
    links.new(half_mul.outputs[0], half_add.inputs[0])
    links.new(half_add.outputs[0], half_pow.inputs[0])
    links.new(half_pow.outputs[0], pipeline_node.inputs["HalfLambert"])


def _build_material_tree(
    material: bpy.types.Material,
    pipeline_group: bpy.types.ShaderNodeTree,
    *,
    use_helper_wiring: bool,
    filepath: str,
) -> None:
    material.use_nodes = True
    node_tree = material.node_tree
    _clear_nodes(node_tree)

    output = node_tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (880, 0)
    emission = node_tree.nodes.new("ShaderNodeEmission")
    emission.location = (620, 0)
    pipeline_node = node_tree.nodes.new("ShaderNodeGroup")
    pipeline_node.node_tree = pipeline_group
    pipeline_node.location = (200, 0)
    pipeline_node.name = "Lutchainer Pipeline"
    pipeline_node.label = "Lutchainer Pipeline"
    pipeline_node["lutchainer_kind"] = "pipeline_node"
    pipeline_node["lutchainer_source_filepath"] = filepath

    pipeline_node.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    for input_name in FLOAT_INPUTS:
        pipeline_node.inputs[input_name].default_value = 0.0
    pipeline_node.inputs["TexCoord"].default_value = (0.0, 0.0, 0.0)

    node_tree.links.new(pipeline_node.outputs["Color"], emission.inputs["Color"])
    node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])

    if use_helper_wiring:
        _build_helper_nodes(node_tree, node_tree.links, pipeline_node)
    else:
        texcoord = node_tree.nodes.new("ShaderNodeTexCoord")
        texcoord.location = (-880, -200)
        rgb = node_tree.nodes.new("ShaderNodeRGB")
        rgb.location = (-880, 180)
        rgb.outputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
        node_tree.links.new(texcoord.outputs["UV"], pipeline_node.inputs["TexCoord"])
        node_tree.links.new(rgb.outputs[0], pipeline_node.inputs["Base Color"])


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
    use_helper_wiring: bool,
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
        use_helper_wiring=use_helper_wiring,
        filepath=filepath,
    )
    _assign_material_to_active_object(context, material)
    return material
