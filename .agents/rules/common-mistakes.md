# common-mistakes.md — Repository-Specific Pitfalls

This file focuses on the mistakes that repeatedly matter in LUT Chainer.

## 1. Wrong Layer for Browser APIs

Bad:

```typescript
// features/** or shared/**
const canvas = document.createElement('canvas');
const dpr = window.devicePixelRatio;
localStorage.setItem('key', value);
```

Why it is wrong:

- breaks CLI reuse
- breaks pure-domain assumptions
- creates illegal upward dependencies

Correct placement:

- `document` / `window` / `navigator` / `File` / `Blob` -> `app/browser` or `platforms/browser`
- WebGL runtime code -> `platforms/webgl`

## 2. Feature Importing App or Platform Code

Bad:

```typescript
import { renderConnectionLayer } from '../../app/browser/connection-renderer.ts';
import { Renderer } from '../../platforms/webgl/renderer.ts';
```

`features/**` must stay free of browser/runtime implementations.

Fix:

- move the browser/runtime logic upward into `app/browser`
- keep only pure types/data/algorithms in `features`

## 3. `platforms/webgl` Accidentally Depending on DOM Globals

Bad:

```typescript
const canvas = document.createElement('canvas');
const dpr = window.devicePixelRatio;
```

`platforms/webgl` should be reusable with alternate WebGL hosts such as headless contexts.

Fix:

- create canvases in `app/browser`
- resolve DPR in `app/browser`
- pass canvas/context/scale into the WebGL runtime

## 4. Direct State Mutation

Bad:

```typescript
getPipelineSteps().push(newStep);
```

Fix:

```typescript
setPipelineSteps([...getPipelineSteps(), newStep]);
```

Or go through the command controller when user action semantics matter.

## 5. Circular Dependencies Through UI Callbacks

Bad:

```typescript
// features/**
import { syncUi } from '../../app/browser/ui/main-ui-setup.ts';
```

Fix:

- inject callbacks through controller/system options
- let `app/browser` orchestrate feature calls

## 6. Wrong Relative Paths

Do not use:

```typescript
import { helper } from '/src/shared/utils/helpers';
import { helper } from '../src/shared/utils/helpers';
```

Use the real relative path from the current file.

When moving files between `features`, `app/browser`, and `platforms/*`, re-check path depth carefully. Most refactor breakage in this repo comes from stale `../../` counts.

## 7. Dynamic CSS Selectors With Arbitrary IDs

Bad:

```typescript
document.querySelector(`[data-lut-id="${lutId}"]`);
```

If `lutId` contains selector-significant characters, the query can break.

Prefer:

```typescript
Array.from(document.querySelectorAll('[data-lut-id]'))
  .find(el => el.getAttribute('data-lut-id') === lutId);
```

## 8. Svelte Built-in Collections Not Reactive

Bad:

```typescript
// inside $state or $derived
const map = new Map<string, Value>();
```

Fix:

```typescript
import { SvelteMap } from 'svelte/reactivity';
const map = new SvelteMap<string, Value>();
```

Use `SvelteMap`, `SvelteSet`, and `SvelteURL` when the collection is stored in `$state` or returned from `$derived`. Plain `Map`/`Set` mutations are not tracked by Svelte's reactivity system.

## 9. Missing Key in `{#each}` Blocks

Bad:

```svelte
{#each items as item}
```

Fix:

```svelte
{#each items as item (item.id)}
```

Always provide a unique key expression. Missing keys cause incorrect DOM reuse when items are added, removed, or reordered.

## 10. CPU / GPU Sampling Drift

Bad:

```typescript
const uPixel = u * (width - 1);
```

Fix:

```typescript
const uPixel = u * width - 0.5;
```

Keep LUT sampling consistent across CPU fallback and WebGL preview.

## 11. WebGL Texture Binding Order

Bad:

```typescript
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.activeTexture(gl.TEXTURE0 + i);
```

Fix:

```typescript
gl.activeTexture(gl.TEXTURE0 + i);
gl.bindTexture(gl.TEXTURE_2D, texture);
```

## 12. CLI Pulling In Browser Code

Bad:

```typescript
// app/cli/**
import { setupMainUi } from '../browser/ui/main-ui-setup.ts';
```

Fix:

- keep CLI dependencies limited to `features`, `shared`, and `platforms/node`
- if CLI needs a constant that currently lives in browser-heavy code, extract that constant into a pure module

## 13. Validation Without Runtime Guards

Bad:

```typescript
const snapshot = JSON.parse(json) as PipelineStateSnapshot;
```

Fix:

- parse as `unknown`
- validate with guards/assert helpers before use

## 14. Refactors That Leave Empty Structure Assumptions

After moving code, update:

- docs
- import paths
- typecheck config assumptions
- any comments that mention old folders such as `shared/ui` or `shared/rendering`

This repo has already moved browser code from `shared/**` into `app/browser/**` and `platforms/**`; stale documentation is a real source of future mistakes.
