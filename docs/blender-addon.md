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
- Add-on Preferences: `Last Fixture Path`, `Reload Script`, `Reload And Reimport`

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

The import operator has `Use Eevee Helper Wiring`.

When enabled, the wrapper material auto-wires:

- `Fresnel` from `Fresnel`
- `Facing` from `1 - Layer Weight.Facing`
- `Lightness` from white `Diffuse BSDF -> Shader to RGB -> RGB to BW`
- `Specular` from white `Glossy BSDF -> Shader to RGB -> RGB to BW`
- `HalfLambert` from the imported `Lightness` approximation

`NdotH` and `LinearDepth` stay exposed as replaceable group inputs in the wrapper material.

## Validation

Static archive validation:

```bash
npm run validate:lutchain-examples
```

Blender headless validation, once Blender is installed:

```bash
blender --background --factory-startup \
  --python scripts/validate_blender_addon.py -- \
  "$(pwd)/blender_addon" \
  "$(pwd)/examples/Metallic.lutchain" \
  "$(pwd)/examples/HueShiftToon.lutchain" \
  "$(pwd)/examples/HueSatShiftToon.lutchain"
```

The headless script checks:

- add-on registration succeeds
- `Reload Script` succeeds for implementation-module changes
- import operator finishes without error
- `Reload And Reimport` succeeds from `Last Fixture Path`
- the wrapper material is created
- the pipeline node exists
- step node count and step metadata match `pipeline.json`
