# blender-addon.md — Blender Add-on Rules

This guide documents repository-specific rules for working on the LUT Chainer Blender add-on.

---

## 1. Source Layout

### Canonical Location

The Blender add-on must live under:

```text
blender_addon/addons/lutchainer_blender_addon/
```

This is intentional.

- Blender `Script Directories` scans `<script_dir>/addons`
- The repo is structured so `blender_addon` itself can be added as a script directory
- Do not reintroduce shim loaders or duplicate add-on roots unless there is a strong reason

### Allowed Companion Files

- Add-on docs: `blender_addon/README.md`
- Validation and compare docs: `tools/blender/README.md`
- Fixture/archive validation: `tests/lutchain/validate-examples.mjs`
- Blender validation scripts: `tests/blender/validate_addon.py`
- Blender visual-compare tools: `tools/blender/compare/`
- Windows bridge scripts: `scripts/run_windows_blender.sh`, `scripts/invoke_windows_blender.ps1`
- Release build script: `scripts/build_blender_addon_release.py`

### Release Build Rule

The repo source is the development build.

- Do not hand-edit the repo into a release-only state
- Use `scripts/build_blender_addon_release.py <version>` to create the installable release zip
- Release packaging must happen in a staged copy, not by mutating tracked add-on files in place
- Release packaging must update the packaged `bl_info["version"]`

---

## 2. Reload Model

### Rule: `Reload Script` Must Be Safe From UI

The add-on's `Reload Script` operator must not unregister or re-register the currently executing operator classes.

**Why**:

- Reloading `__init__.py` while a UI operator is executing can invalidate Blender RNA objects
- This has already caused Blender crashes during `Reload And Reimport`
- UI-triggered reload must be conservative

### Correct Behavior

`Reload Script` should only reload implementation submodules such as:

- `manifest.py`
- `node_builder.py`
- `dev_reload.py`

It must not:

- call `unregister()` on the live add-on from the button operator
- call `register()` again from the same operator execution path
- reload the root package in a way that recreates active operator classes during execution

### When Full Reload Is Required

If a change touches:

- `__init__.py`
- class registration
- panel layout definitions
- operator declarations
- menu registration

use Blender's global `Reload Scripts` instead of the add-on's `Reload Script`.

### Rule: Release Builds Must Hide Debug UI

Release builds should keep import UI and the non-debug preference needed to choose the default lightness mode.

Release builds must not register:

- `Reload Script`
- `Reload And Reimport`
- Shader Editor sidebar panel

Release builds may still register add-on preferences, but only the non-debug controls such as `Lightness Mode By Default` should be visible there.

---

## 3. Preferences and Paths

### Rule: No Development `Script Path` Preference

Do not add a separate add-on preference for locating development source when the add-on is already loaded from `Script Directories`.

**Use instead**:

- `__file__`
- `Path(__file__)`
- module import metadata

The current add-on should resolve its own runtime location from the loaded package.

### Allowed Preferences

Keep preferences limited to user-facing state such as:

- `Last Fixture Path`
- helper wiring defaults

Do not add redundant path configuration unless the add-on genuinely supports multiple independent source roots.

---

## 4. Wrapper Material Layout

### High-Level Node Layout

The wrapper material should read left-to-right:

1. Input/helper nodes on the left
2. `Lutchainer Pipeline` in the center
3. Post-process/output nodes on the right

Current intent:

- Left: `Base Color`, `TexCoord`, helper parameter networks
- Center: imported pipeline group
- Right: `Emission`, `Material Output`

Do not scatter helper nodes across both sides of the pipeline without a good reason.

### Parameter Grouping

Helper nodes should be organized by parameter semantics.

Use bare nodes for single-node parameters such as:

- `Base Color`
- `TexCoord`
- `Fresnel`

Use frames named after the parameter for multi-node constructions such as:

- `Facing`
- `Lightness`
- `Specular`
- `HalfLambert`

Avoid large generic frames like `Inputs` or `Lighting Helpers` when parameter-specific grouping is clearer.

---

## 5. Shader Parameter Semantics

### Facing

`Facing` in LUT Chainer is white when facing the camera and black near edges.

Blender's `Layer Weight.Facing` has the opposite practical meaning for this use case, so it must be inverted:

```text
Facing = 1 - Layer Weight.Facing
```

### Fresnel

Use Blender's `Fresnel` node for the `Fresnel` parameter.

Do not derive `Fresnel` from `Layer Weight` if the dedicated `Fresnel` node is available.

### Keep Context Replaceable

The pipeline group still needs exposed inputs for shader context values:

- `Lightness`
- `Specular`
- `HalfLambert`
- `Fresnel`
- `Facing`
- `NdotH`
- `LinearDepth`

Helper wiring is a convenience layer, not the only valid source of these values.

### Lightness Modes

`Lightness` helper generation currently supports these modes:

- `shader_to_rgb`
- `dot_nl`
- `raycast`

Rules:

- `HalfLambert` must use the selected mode's Lambert-family value before the normal Lightness clamp
- `dot_nl` and `raycast` may introduce helper nodes such as `Geometry` and `Light Position`
- `raycast` must be treated as Blender 5.1+ only
- do not silently auto-fallback from `raycast` to another mode

---

## 6. Step Group Interface Rules

### Only Expose Used Inputs

Per-step node groups must only expose the sockets actually used by that step.

Examples:

- If a step uses `xParam = lightness`, include `Lightness`
- If a step does not use `Specular`, do not expose `Specular`
- Only expose `TexCoord` when `texU` or `texV` is used

Unused sockets make the generated graph noisy and harder to inspect.

### Preserve Step Traceability

Each generated step should still preserve:

- step order
- step label
- original step metadata
- muted state

Simplifying sockets must not reduce debuggability.

---

## 7. Validation Workflow

### Minimum Validation

After Blender add-on changes, run:

```bash
npm run validate:lutchain-examples
npm run typecheck
```

For browser-vs-Blender appearance checks, prefer `tools/blender/compare/setup_visual_compare.py` over ad hoc MCP snippets.

Rules:

- comparison-only scene changes such as black world background belong in the compare script, not in the add-on import path
- the compare script may reset the scene and set color management to `Standard`
- the add-on itself must continue to avoid mutating world settings during normal import
- browser-side compare automation may use `window.__debugMainPreview` for preset load, orbit control, material/light overrides, and sphere sample capture
- if precise browser camera control is needed, add it to the browser debug API instead of relying on fragile pointer dragging in automation

### Blender Validation

When Blender behavior changes, validate with the repo's headless script:

```bash
blender --background --factory-startup \
  --python tests/blender/validate_addon.py -- \
  "$(pwd)/blender_addon" \
  "$(pwd)/examples/Metallic.lutchain" \
  "$(pwd)/examples/HueShiftToon.lutchain" \
  "$(pwd)/examples/HueSatShiftToon.lutchain"
```

Preferred Windows invocation:

```bash
scripts/run_windows_blender.sh \
  --background --factory-startup \
  --python tests/blender/validate_addon.py -- \
  blender_addon \
  examples/Metallic.lutchain \
  examples/HueShiftToon.lutchain \
  examples/HueSatShiftToon.lutchain \
  examples/StandardToon.lutchain
```

`scripts/run_windows_blender.sh` should absorb WSL-to-Windows path conversion. `scripts/run_windows_blender_validation.ps1` may remain as a thin compatibility wrapper, but docs and automation should prefer the unified `invoke_windows_blender.ps1` path.

### Do Not Claim GUI Safety From Headless Only

Headless validation is necessary but not sufficient for UI-triggered reload behavior.

If a change affects:

- reload operators
- panels
- menu registration
- UI-driven node rebuilding

be careful about claims of safety until the GUI path has been exercised.

---

## 8. Common Failure Modes

### Failure: Blender Crashes on `Reload And Reimport`

Likely cause:

- stale RNA objects or old preference references accessed after reload
- unregister/register performed during active operator execution

Fix approach:

- snapshot preference values into plain Python types before reload
- avoid touching old Blender RNA objects after reload
- keep UI-triggered reload to submodule reload only

### Failure: Add-on Not Visible in Blender

Likely cause:

- the user added the wrong path to `Script Directories`

Correct setup:

- add `.../lutchainer/blender_addon`
- Blender will scan `.../lutchainer/blender_addon/addons`

Do not instruct users to add the package directory itself as a script directory.

### Failure: Node Layout Regresses Into Clutter

Likely cause:

- helpers added ad hoc without respecting left/center/right structure
- generic frames replacing semantic grouping

Fix approach:

- re-center around wrapper material readability
- group by parameter, not by implementation accident
