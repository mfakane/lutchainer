from __future__ import annotations

from dataclasses import dataclass
import json
import os
import re
import zipfile

BLEND_MODES = {
    "none",
    "replace",
    "add",
    "subtract",
    "multiply",
    "hue",
    "saturation",
    "color",
    "value",
    "selfBlend",
    "customRgb",
    "customHsv",
}
BLEND_OPS = {"none", "replace", "add", "subtract", "multiply"}
PARAM_NAMES = {
    "lightness",
    "specular",
    "halfLambert",
    "fresnel",
    "facing",
    "nDotH",
    "linearDepth",
    "r",
    "g",
    "b",
    "h",
    "s",
    "v",
    "texU",
    "texV",
    "zero",
    "one",
}
CHANNEL_NAMES = {"r", "g", "b", "h", "s", "v"}
LUT_FILENAME_RE = re.compile(r"^luts/[^/]+\.png$")
MAX_LABEL_LENGTH = 40
CUSTOM_PARAM_ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,31}$")


@dataclass(frozen=True)
class LutchainCustomParam:
    id: str
    label: str
    default_value: float


@dataclass(frozen=True)
class LutchainLut:
    id: str
    name: str
    filename: str
    width: int
    height: int
    png_bytes: bytes


@dataclass(frozen=True)
class LutchainStep:
    id: str
    lut_id: str
    blend_mode: str
    x_param: str
    y_param: str
    label: str | None
    muted: bool
    ops: dict[str, str]


@dataclass(frozen=True)
class LutchainImportData:
    version: int
    display_name: str
    luts: list[LutchainLut]
    steps: list[LutchainStep]
    custom_params: list[LutchainCustomParam]


def _require_record(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _require_int(value: object, label: str, *, min_value: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{label} must be an integer")
    if value < min_value:
        raise ValueError(f"{label} must be >= {min_value}")
    return value


def _require_text(value: object, label: str, *, max_length: int = 200) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be a string")
    text = value.strip()
    if not text:
        raise ValueError(f"{label} must not be empty")
    if len(text) > max_length:
        raise ValueError(f"{label} must be <= {max_length} characters")
    return text


def _parse_ops(raw_ops: object, label: str) -> dict[str, str]:
    if raw_ops is None:
        return {}
    record = _require_record(raw_ops, label)
    ops: dict[str, str] = {}
    for key, raw_value in record.items():
        if key not in CHANNEL_NAMES:
            raise ValueError(f"{label}.{key} is not a valid channel")
        value = _require_text(raw_value, f"{label}.{key}", max_length=24)
        if value not in BLEND_OPS:
            raise ValueError(f"{label}.{key} is not a valid blend op")
        ops[key] = value
    return ops


def _parse_param_ref(value: object, label: str) -> str:
    param_name = _require_text(value, label, max_length=100)
    if param_name in PARAM_NAMES:
        return param_name
    if not param_name.startswith("custom:"):
        raise ValueError(f"{label} is not supported")
    custom_param_id = param_name.split(":", 1)[1]
    if not CUSTOM_PARAM_ID_RE.match(custom_param_id):
        raise ValueError(f"{label} is not supported")
    return param_name


def _parse_lut(index: int, raw_lut: object, archive: zipfile.ZipFile) -> LutchainLut:
    record = _require_record(raw_lut, f"luts[{index}]")
    lut_id = _require_text(record.get("id"), f"luts[{index}].id", max_length=128)
    name = _require_text(record.get("name"), f"luts[{index}].name")
    filename = _require_text(record.get("filename"), f"luts[{index}].filename", max_length=500)
    if not LUT_FILENAME_RE.match(filename):
        raise ValueError(f"luts[{index}].filename must match luts/<id>.png")
    width = _require_int(record.get("width"), f"luts[{index}].width", min_value=2)
    height = _require_int(record.get("height"), f"luts[{index}].height", min_value=2)
    try:
        png_bytes = archive.read(filename)
    except KeyError as exc:
        raise ValueError(f"missing LUT image '{filename}' in archive") from exc
    return LutchainLut(
        id=lut_id,
        name=name,
        filename=filename,
        width=width,
        height=height,
        png_bytes=png_bytes,
    )


def _parse_step(index: int, raw_step: object) -> LutchainStep:
    record = _require_record(raw_step, f"steps[{index}]")
    raw_step_id = record.get("id")
    if isinstance(raw_step_id, int) and not isinstance(raw_step_id, bool):
        step_id = str(_require_int(raw_step_id, f"steps[{index}].id", min_value=1))
    else:
        step_id = _require_text(raw_step_id, f"steps[{index}].id", max_length=128)
    lut_id = _require_text(record.get("lutId"), f"steps[{index}].lutId", max_length=128)
    blend_mode = _require_text(record.get("blendMode"), f"steps[{index}].blendMode", max_length=32)
    if blend_mode not in BLEND_MODES:
        raise ValueError(f"steps[{index}].blendMode is not supported")
    x_param = _parse_param_ref(record.get("xParam"), f"steps[{index}].xParam")
    y_param = _parse_param_ref(record.get("yParam"), f"steps[{index}].yParam")

    raw_label = record.get("label")
    label = None
    if raw_label is not None:
        label = _require_text(raw_label, f"steps[{index}].label", max_length=MAX_LABEL_LENGTH)

    raw_muted = record.get("muted", False)
    if not isinstance(raw_muted, bool):
        raise ValueError(f"steps[{index}].muted must be a boolean")

    ops = _parse_ops(record.get("ops"), f"steps[{index}].ops")
    return LutchainStep(
        id=step_id,
        lut_id=lut_id,
        blend_mode=blend_mode,
        x_param=x_param,
        y_param=y_param,
        label=label,
        muted=raw_muted,
        ops=ops,
    )


def _parse_custom_param(index: int, raw_custom_param: object) -> LutchainCustomParam:
    record = _require_record(raw_custom_param, f"customParams[{index}]")
    custom_param_id = _require_text(record.get("id"), f"customParams[{index}].id", max_length=32)
    if not CUSTOM_PARAM_ID_RE.match(custom_param_id):
        raise ValueError(f"customParams[{index}].id is invalid")
    label = _require_text(record.get("label"), f"customParams[{index}].label", max_length=MAX_LABEL_LENGTH)
    default_value_raw = record.get("defaultValue")
    if not isinstance(default_value_raw, (int, float)):
        raise ValueError(f"customParams[{index}].defaultValue must be a number")
    default_value = max(0.0, min(1.0, float(default_value_raw)))
    return LutchainCustomParam(id=custom_param_id, label=label, default_value=default_value)


def load_lutchain_file(filepath: str) -> LutchainImportData:
    if not filepath or not filepath.lower().endswith(".lutchain"):
        raise ValueError("Expected a .lutchain filepath")

    with zipfile.ZipFile(filepath, "r") as archive:
        try:
            payload = json.loads(archive.read("pipeline.json").decode("utf-8"))
        except KeyError as exc:
            raise ValueError("Missing pipeline.json in .lutchain archive") from exc
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid pipeline.json: {exc}") from exc

        root = _require_record(payload, "pipeline.json")
        version = _require_int(root.get("version"), "version", min_value=1)
        if version != 2:
            raise ValueError(f"Unsupported .lutchain version: {version}")

        raw_luts = root.get("luts")
        raw_steps = root.get("steps")
        raw_custom_params = root.get("customParams", [])
        if not isinstance(raw_luts, list) or not raw_luts:
            raise ValueError("luts must be a non-empty array")
        if not isinstance(raw_steps, list):
            raise ValueError("steps must be an array")
        if not isinstance(raw_custom_params, list):
            raise ValueError("customParams must be an array when provided")

        luts = [_parse_lut(index, entry, archive) for index, entry in enumerate(raw_luts)]
        lut_ids = {lut.id for lut in luts}
        if len(lut_ids) != len(luts):
            raise ValueError("Duplicate LUT ids are not allowed")

        custom_params = [_parse_custom_param(index, entry) for index, entry in enumerate(raw_custom_params)]
        custom_param_ids = {custom_param.id for custom_param in custom_params}
        if len(custom_param_ids) != len(custom_params):
            raise ValueError("Duplicate custom param ids are not allowed")

        steps = [_parse_step(index, entry) for index, entry in enumerate(raw_steps)]
        step_ids = {step.id for step in steps}
        if len(step_ids) != len(steps):
            raise ValueError("Duplicate step ids are not allowed")

        for step in steps:
            if step.lut_id not in lut_ids:
                raise ValueError(f"Step {step.id} references unknown LUT '{step.lut_id}'")
            for param_name in (step.x_param, step.y_param):
                if param_name in PARAM_NAMES:
                    continue
                if not param_name.startswith("custom:"):
                    raise ValueError(f"Step {step.id} references unsupported parameter '{param_name}'")
                custom_param_id = param_name.split(":", 1)[1]
                if custom_param_id not in custom_param_ids:
                    raise ValueError(f"Step {step.id} references unknown custom param '{custom_param_id}'")

    display_name = os.path.splitext(os.path.basename(filepath))[0]
    return LutchainImportData(
        version=version,
        display_name=display_name,
        luts=luts,
        steps=steps,
        custom_params=custom_params,
    )
