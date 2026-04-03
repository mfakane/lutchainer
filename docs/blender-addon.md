# Blender Add-on

`blender_addon/addons/lutchainer_blender_addon` contains the Blender add-on source and is structured so Blender can discover it directly through `Script Directories`.

## What it creates

- A new material named `<file> Lutchainer Material`
- One top-level node group named `Lutchainer Pipeline`
- One child node group per step, preserving step order and metadata
- Packed Blender images for each LUT PNG in the archive

The imported pipeline exposes these group inputs:

- `Base Color`
- `Lightness`
- `Specular`
- `HalfLambert`
- `Fresnel`
- `Facing`
- `NdotH`
- `LinearDepth`
- `TexCoord`

This is intentional. `.lutchain` stores the LUT chain, but it does not store the original app's material/light settings, so the Blender side keeps those context values replaceable.

## Install in Blender

1. Open Blender 4.x or newer.
2. Go to `Edit > Preferences > File Paths`.
3. Add this repo's `blender_addon` directory to `Script Directories`.
4. Run Blender's `Reload Scripts`.
5. Go to `Edit > Preferences > Add-ons`.
6. Search for `LUT Chainer Importer` and enable it.

After enabling:

- `File > Import > LUT Chainer (.lutchain)`
- Shader Editor sidebar: `LUT Chainer` tab
- Add-on Preferences: `Last Fixture Path`, `Lightness Mode By Default`, `Reload Script`, `Reload And Reimport`

## Development Reload

For development, you do not need to rebuild a zip every time.

1. Enable the add-on once using the `Script Directories` flow above.
2. Open the add-on preferences.
3. Optionally import a `.lutchain` once so `Last Fixture Path` is stored.
4. Use Blender's global `Reload Scripts` if you want Blender to rescan `blender_addon/addons`.
5. Use the add-on's `Reload Script` to reload the implementation modules from disk.
6. Use `Reload And Reimport` to reload the implementation modules and immediately re-import `Last Fixture Path`.
7. If you changed `__init__.py` itself, or changed class registration/UI layout, use Blender's global `Reload Scripts` instead.

Important:

- `Script Directories` must point to `.../lutchainer/blender_addon`
- Blender scans `<script_dir>/addons`, and this repo now places the add-on there directly

## Helper wiring

The import operator has `Lightness Mode`.

Available modes:

- `Shader to RGB`: `Diffuse BSDF -> Shader to RGB -> ColorRamp`
- `dot(N, L)`: `dot(normal, normalize(lightPosition - position))`
- `Raycast`: shadowed `dot(N, L)` using the shader `Raycast` node

The wrapper material also auto-wires:

- `Fresnel` from `Fresnel`
- `Facing` from `1 - Layer Weight.Facing`
- `Specular` from `Eevee Specular -> Shader to RGB -> RGB to BW`
- `HalfLambert` from the selected mode's pre-clamp Lambert value

For `dot(N, L)` and `Raycast`, the wrapper also creates:

- `Geometry`
- `Light Position`

`NdotH` and `LinearDepth` stay exposed as replaceable group inputs in the wrapper material.
`Raycast` mode requires Blender 5.1 or newer.

## Visual Compare Script

For browser-vs-Blender checks, use `scripts/setup_blender_visual_compare.py`.

This script is intentionally separate from the add-on import path. It applies comparison-only scene settings:

- `Color Management = Standard`
- `Display Device = sRGB`
- `World Background = black`, `Strength = 0`
- a new UV sphere and camera
- add-on reload + `.lutchain` import

This keeps the add-on itself free of scene-wide side effects.

Headless usage:

```bash
blender --background --factory-startup \
  --python scripts/setup_blender_visual_compare.py -- \
  "$(pwd)/blender_addon" \
  "$(pwd)/examples/Metallic.lutchain" \
  dot_nl
```

Blender MCP usage:

```python
import runpy

script = r"/absolute/path/to/scripts/setup_blender_visual_compare.py"
setup = runpy.run_path(script)["setup_visual_compare"]
result = setup(
    addon_parent=r"/absolute/path/to/blender_addon",
    fixture_path=r"/absolute/path/to/examples/Metallic.lutchain",
    lightness_mode="dot_nl",
)
print(result)
```

## Browser Debug API

The browser app also exposes a console debug API for visual-compare automation:

- `window.__debugMainPreview.getOrbit()`
- `window.__debugMainPreview.setOrbit({ orbitPitchDeg, orbitYawDeg, orbitDist })`
- `window.__debugMainPreview.resetOrbit()`
- `window.__debugMainPreview.loadPreset('Metallic')`
- `window.__debugMainPreview.getMaterialSettings()`
- `window.__debugMainPreview.setMaterialSettings({ baseColor: [0.9, 0.9, 0.9] })`
- `window.__debugMainPreview.setBaseColor([0.9, 0.9, 0.9])`
- `window.__debugMainPreview.getLightSettings()`
- `window.__debugMainPreview.setLightSettings({ ambientColor: [0, 0, 0] })`
- `window.__debugMainPreview.sampleSpherePoints()`
- `window.__debugMainPreview.setOrbitAndSampleSphere({ orbitPitchDeg: 25, orbitYawDeg: 45, orbitDist: 2.8 })`
- `window.__debugMainPreview.sampleGrid({ divisions: 8, outputSize: 512 })`
- `window.__debugMainPreview.setOrbitAndSampleGrid({ orbitPitchDeg: 25, orbitYawDeg: 45, orbitDist: 2.8 }, 8)`
- `window.__debugMainPreview.exportFixedSizePng(512)`

This is intended for browser-vs-Blender checks without requiring manual UI interaction.

Example:

```js
await window.__debugMainPreview.loadPreset('Metallic');
window.__debugMainPreview.setBaseColor([0.9, 0.9, 0.9]);
const browserReport = await window.__debugMainPreview.setOrbitAndSampleGrid({
  orbitPitchDeg: 25,
  orbitYawDeg: 45,
  orbitDist: 2.8,
}, 8);
const pngDataUrl = await window.__debugMainPreview.exportFixedSizePng(512);
console.log(browserReport, pngDataUrl);
```

## Sphere Sample Compare

Blender-side sample report:

```bash
blender --background --factory-startup \
  --python-expr "import json,runpy; mod=runpy.run_path(r'$(pwd)/scripts/sample_blender_compare_points.py'); print(json.dumps(mod['sample_blender_compare_points'](addon_parent=r'$(pwd)/blender_addon', fixture_path=r'$(pwd)/examples/Metallic.lutchain', lightness_mode='dot_nl'), ensure_ascii=True))"
```

Report diff:

```bash
node scripts/compare_sphere_sample_reports.mjs browser-report.json blender-report.json
```

The sample reports use the same normalized `8 x 8` image grid, and the browser debug API can also export a fixed-size square PNG for side-by-side inspection.

## Validation

Static archive validation:

```bash
npm run validate:lutchain-examples
```

Blender headless validation, once Blender is installed:

```bash
scripts/run_windows_blender.sh run_windows_blender_validation.ps1 \
  -ValidationScript "$(wslpath -w "$(pwd)/scripts/validate_blender_addon.py")" \
  -AddonParent "$(wslpath -w "$(pwd)/blender_addon")" \
  -FixtureList "$(wslpath -w "$(pwd)/examples/Metallic.lutchain")|$(wslpath -w "$(pwd)/examples/HueShiftToon.lutchain")|$(wslpath -w "$(pwd)/examples/HueSatShiftToon.lutchain")"
```

The shell wrapper reads `BLENDER_EXECUTABLE` from `.env` and invokes PowerShell for you.

For raw Blender invocations, use:

```bash
scripts/run_windows_blender.sh invoke_windows_blender.ps1 --background --factory-startup --version
```

The headless script checks:

- add-on registration succeeds
- `Reload Script` succeeds for implementation-module changes
- import operator finishes without error
- `Reload And Reimport` succeeds from `Last Fixture Path`
- `Shader to RGB`, `dot(N, L)`, and on Blender 5.1 `Raycast` all import successfully
- the wrapper material is created
- the pipeline node exists
- step node count and step metadata match `pipeline.json`
