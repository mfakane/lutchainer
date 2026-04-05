# AGENTS.md

This document provides repo-specific guidance for AI coding agents working on LUT Chainer.

## Development Commands

```bash
# Build web + CLI bundles
npm run build

# Watch mode
npm run dev

# Type check only
npm run typecheck
```

Use a local HTTP server when validating the web app:

```bash
npm run build
npm run serve
# http://localhost:8000
```

Do not rely on `file://index.html`. Example preset loading expects HTTP.

## Project Overview

LUT Chainer is a browser-based shader editor for authoring LUT step chains.

Main capabilities:

- edit LUT step chains and blend modes
- preview the result in real time with WebGL and CPU fallback
- tweak material and light settings
- export generated GLSL / HLSL
- save and load `.lutchain` archives

## Architecture

### Current Layering

```text
app/browser/      Browser app orchestration, DOM wiring, SolidJS mounts
platforms/webgl/  DOM-free WebGL runtime implementations
platforms/browser/Browser API adapters (storage, download, file helpers)
features/         Domain models and pure business logic
shared/           Pure cross-cutting helpers and archive code
app/cli/          Node CLI entrypoints and commands
platforms/node/   Node runtime adapters
```

### Dependency Direction

Allowed direction:

```text
app/browser  -> features, shared, platforms/browser, platforms/webgl
app/cli      -> features, shared, platforms/node
platforms/*  -> features, shared
features     -> shared
shared       -> (no app/platform imports)
```

Forbidden direction:

- `features/**` must not import from `app/**` or `platforms/**`
- `shared/**` must not import from `app/**` or `platforms/**`
- `platforms/webgl/**` must not use `document`, `window`, `navigator`, or SolidJS
- `app/cli/**` must not import from `app/browser/**` or browser-only modules

### Practical Meaning

- Put DOM orchestration, event wiring, and SolidJS components in `src/app/browser/`
- Put WebGL renderer classes and texture/program helpers in `src/platforms/webgl/`
- Put browser storage/download/file adapters in `src/platforms/browser/`
- Keep `src/features/` pure enough that it can be reused by browser, CLI, and Blender-related tooling
- Keep `src/shared/` limited to pure helpers such as math, geometry, and archive parsing/serialization

## File Roles

Use these naming patterns consistently:

| Pattern | Role |
|---------|------|
| `*-model.ts` | immutable models, enums, constants |
| `*-state.ts` | mutable state + getter/setter access |
| `*-runtime.ts` | pure computation logic |
| `*-controller.ts` | stateful controllers created via factory |
| `*-bindings.ts` | event binding and interaction wiring |
| `*-view.ts` | UI-facing derived state and helpers |
| `*-system.ts` | lifecycle-managed runtime subsystem |
| `solid-*.tsx` | SolidJS component modules with `mount*`/`sync*` exports |
| `main-*.ts` | browser bootstrap/orchestration modules |
| `types.ts` | type-only barrel exports |

## Core Rules

### 1. No Layer Violations

Bad:

- `features/**` importing DOM code, SolidJS, or `platforms/webgl`
- `platforms/webgl/**` importing browser DOM helpers
- `app/cli/**` importing browser-only modules

Good:

```typescript
// features/step/step-runtime.ts
export function composeColorFromSteps(steps: readonly StepRuntimeModel[]): Color { ... }

// app/browser/ui/main-ui-setup.ts
import { composeColorFromSteps } from '../../../features/step/step-runtime.ts';
```

### 2. State Access Through APIs

Do not mutate shared state objects directly. Use controller/state APIs or injected callbacks.

Good:

```typescript
const controller = createPipelineCommandController({
  getSteps: () => getPipelineSteps(),
  setSteps: steps => setPipelineSteps(steps),
  status: (message, kind) => showStatus(message, kind),
  t,
});
```

### 3. SolidJS JSX Constraints

Comma operator in JSX is invalid in this repo’s SolidJS setup.

Bad:

```tsx
<span>{(language(), formatParam(param))}</span>
```

Good:

```tsx
function renderParamLabel(param: ParamName): string {
  language();
  return formatParam(param);
}

<span>{renderParamLabel(param)}</span>
```

### 4. TypeScript Strictness

Important defaults:

- `strict: true`
- `target: ES2020`
- `jsxImportSource: "solid-js"`

Implications:

- avoid implicit `any`
- avoid `String.prototype.replaceAll()`
- prefer explicit callback parameter types when inference is weak

### 5. CPU / GPU Consistency

CPU fallback and WebGL preview must match. Preserve texel-center sampling.

Good:

```typescript
const uPixel = u * width - 0.5;
const vPixel = v * height - 0.5;
```

## Common Pitfalls

### Import Paths

Do not use `/src/...` or `../src/...`. Use correct relative paths from the current file.

### Dynamic DOM Selectors

Do not interpolate dynamic IDs directly into CSS selectors if they may contain special characters.

Prefer:

```typescript
const element = Array.from(document.querySelectorAll('[data-lut-id]'))
  .find(node => node.getAttribute('data-lut-id') === lutId);
```

### Browser APIs in the Wrong Layer

If code touches:

- `document`
- `window`
- `navigator`
- `localStorage`
- `File`, `Blob`, object URLs

it belongs in `app/browser` or `platforms/browser`, not `features` or `shared`.

If code touches:

- `WebGLRenderingContext`
- texture/program/buffer management

it belongs in `platforms/webgl`, unless it is pure shader/data logic with no runtime dependency.

## Directory Reference

```text
src/
├─ app/
│  ├─ browser/
│  └─ cli/
├─ features/
│  ├─ lut-editor/
│  ├─ pipeline/
│  ├─ shader/
│  └─ step/
├─ platforms/
│  ├─ browser/
│  ├─ node/
│  └─ webgl/
├─ shared/
│  ├─ lutchain/
│  └─ utils/
└─ types/
```

## Before Editing

- confirm the target layer is correct before adding a file
- prefer moving browser/runtime code out of `features` rather than importing upward
- keep `shared` pure
- keep `platforms/webgl` reusable without DOM globals
- run `npm run typecheck` after TypeScript changes

## Related Docs

- `.claude/rules/coding-style.md`
- `.claude/rules/common-mistakes.md`
- `.claude/rules/blender-addon.md`
