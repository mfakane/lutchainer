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

## Release Build

Use the release packaging script to generate an installable zip:

```bash
python3 scripts/build_blender_addon_release.py 0.2.1
```

Output:

- `artifacts/lutchainer_blender_addon-0.2.1.zip`

The script updates the packaged add-on's `bl_info["version"]` and builds a staged release zip without modifying the repo's tracked add-on source.

Release builds keep only the import flow:

- `File > Import > LUT Chainer (.lutchain)`
- Add-on Preferences: `Lightness Mode By Default`

Release builds do not register:

- Shader Editor sidebar panel
- `Last Fixture Path`
- `Reload Script`
- `Reload And Reimport`

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
- The repo source is always the debug/development build; release packaging is done via `scripts/build_blender_addon_release.py`

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
