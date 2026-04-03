---
name: playwright-blender-compare
description: Reuse the Playwright and Blender comparison workflow for this repo's `.lutchain` preview validation. Use when comparing a preset or `.lutchain` file between `http://localhost:8000/` and the Blender add-on, when collecting square PNG artifacts or grid-sampled color reports, when checking multiple base colors or lightness modes, or when debugging mismatches in LUT sampling, HSV blending, helper inputs, or color-space handling.
---

# Playwright Blender Compare

Use this skill to run the repo's repeatable browser-vs-Blender sampling workflow.

Read [references/repo-context.md](./references/repo-context.md) before acting. It contains the repo-specific entry points, script paths, and known failure modes.

## Workflow

1. Confirm prerequisites.
2. Prepare the browser preview state with the debug API.
3. Prepare the Blender compare scene with the compare scripts.
4. Produce browser and Blender artifacts or JSON reports.
5. Compare the outputs and isolate the mismatch layer.

## Prerequisites

- Ensure the app is served at `http://localhost:8000/`.
- Ensure the browser page has the latest bundle loaded before using `window.__debugMainPreview`.
- Prefer Blender MCP when it is connected and responsive.
- If Blender MCP is unavailable, fall back to the Windows Blender wrapper scripts under `scripts/`.
- Treat compare-scene settings as test-only. Do not change World settings in the normal add-on import path.

## Browser Side

- Navigate to `http://localhost:8000/` with Playwright.
- Use `window.__debugMainPreview.loadPreset(...)` or equivalent debug calls instead of UI clicking when repeatability matters.
- Set explicit base color, ambient color, and orbit before sampling.
- Prefer `sampleGrid({ divisions, outputSize, orbit })` for report generation.
- Use `exportFixedSizePng(size)` when a square browser artifact is needed.

## Blender Side

- Use `scripts/setup_blender_visual_compare.py` to rebuild the compare scene.
- Use `scripts/sample_blender_compare_points.py` to generate grid-sampled JSON reports.
- Use `scripts/render_blender_visual_compare.py` to render square PNG artifacts.
- Pass compare-only `base_color` overrides through the compare scripts.
- Keep the user-facing add-on defaults intact unless the user explicitly asks to change them.

## Matching Rules

- Match preset, output size, grid divisions, orbit, lightness mode, and base color before comparing.
- Remember that compare-script base colors are browser-style perceptual values in `0..1`.
- Remember that the compare scripts convert those values to Blender linear values before import.
- Prefer square output sizes on both sides.
- Use the same grid division count on both sides.

## Debug Heuristics

- If a color band appears mirrored vertically, inspect LUT `V` direction first.
- If grayscale browser output becomes tinted in Blender, inspect HSV extraction and HSV-layer blending.
- If Blender looks too bright overall, inspect whether a browser-style base color was passed into Blender without linearization.
- If only dark background cells differ, inspect compare-scene World and color management before changing shader logic.
- If compare results are stale after a rebuild, hard-reload the browser page and rerun the browser debug API calls.

## Comparison Output

- Save browser and Blender reports separately.
- Save rendered PNG artifacts in `artifacts/`.
- Use `scripts/compare_sphere_sample_reports.mjs` to compute aggregate deltas.
- Report both summary metrics and representative cells when describing a mismatch.
