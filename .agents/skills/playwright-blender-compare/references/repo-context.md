# Repo Context

## Browser entry points

- URL: `http://localhost:8000/`
- Debug global: `window.__debugMainPreview`
- Common methods:
  - `loadPreset(name)`
  - `setBaseColor([r, g, b])`
  - `setLightSettings({...})`
  - `setOrbit(...)`
  - `sampleGrid({ divisions, outputSize, orbit })`
  - `exportFixedSizePng(size)`

## Blender compare scripts

- `scripts/setup_blender_visual_compare.py`
  - Rebuild compare scene
  - Set `Standard` view transform
  - Set black World for compare-only scenes
  - Replace the default cube with a smooth UV sphere
  - Create a compare camera matching the browser orbit
- `scripts/sample_blender_compare_points.py`
  - Render and sample a grid report
- `scripts/render_blender_visual_compare.py`
  - Render a square PNG artifact
- `scripts/compare_sphere_sample_reports.mjs`
  - Compare browser and Blender JSON reports

## Compare defaults

- Orbit:
  - `pitch = 25`
  - `yaw = 45`
  - `dist = 2.8`
- Typical output size: `512x512`
- Typical grid divisions: `8`
- Typical lightness mode: `dot_nl`
- Typical compare base color: `(0.9, 0.9, 0.9)`

## Important behavior

- Compare-script base colors are browser-style perceptual values in `0..1`.
- Compare scripts convert those values to Blender linear values before import.
- Normal add-on import keeps its own user-facing defaults.

## Known pitfalls

- Browser and Blender can disagree because of:
  - LUT `V` orientation
  - HSV-layer implementation details
  - helper-node approximations for `Lightness`, `Facing`, `Fresnel`, `Specular`
  - color-space mismatch on base colors
- Browser debug APIs can be stale if the page was not hard-reloaded after a build.
- Blender CLI from WSL can be brittle; Blender MCP is often simpler when connected.
