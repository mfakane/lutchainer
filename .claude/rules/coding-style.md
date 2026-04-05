# coding-style.md — TypeScript + Layering Rules

This file captures the coding conventions that matter most in this repo.

## 1. Compiler Assumptions

The codebase is written under strict TypeScript.

Important implications:

- `strict: true` is on
- target is `ES2020`
- SolidJS JSX is enabled in the browser build
- browser and CLI typechecking are intentionally separated

Practical rules:

- do not rely on implicit `any`
- do not use `String.prototype.replaceAll()`
- do not make CLI compile depend on DOM/browser modules

## 2. Layer Rules

### Allowed imports

```text
app/browser  -> features, shared, platforms/browser, platforms/webgl
app/cli      -> features, shared, platforms/node
platforms/*  -> features, shared
features     -> shared
shared       -> pure only
```

### Forbidden imports

- `features/**` -> `app/**`
- `features/**` -> `platforms/**`
- `shared/**` -> `app/**`
- `shared/**` -> `platforms/**`
- `platforms/webgl/**` -> DOM globals, SolidJS, `platforms/browser/**`
- `app/cli/**` -> `app/browser/**`

### Placement guide

Put code here:

- `src/features/`: models, validation, blend/runtime logic, archive semantics
- `src/shared/`: pure helpers, math/geometry, archive utilities
- `src/platforms/webgl/`: WebGL renderer classes, texture/program helpers
- `src/platforms/browser/`: `localStorage`, download, file/blob/objectURL helpers
- `src/app/browser/`: DOM wiring, event binding, SolidJS mounts, browser runtime orchestration

## 3. Naming Patterns

| Pattern | Purpose |
|---------|---------|
| `*-model.ts` | data schema, enums, constants |
| `*-state.ts` | mutable state accessor module |
| `*-runtime.ts` | pure algorithms |
| `*-controller.ts` | stateful controller factory |
| `*-bindings.ts` | event binding glue |
| `*-view.ts` | UI-facing state helpers |
| `*-system.ts` | lifecycle-managed subsystem |
| `solid-*.tsx` | SolidJS component module |
| `main-*.ts` | browser bootstrap/orchestrator |
| `types.ts` | type-only barrel |

## 4. Imports

Prefer this order:

1. external packages
2. `features/**`
3. `shared/**`
4. `platforms/**`
5. sibling/local modules

Do not use:

- `/src/...`
- `../src/...`
- logic barrels such as `index.ts` that re-export whole subsystems

`types.ts` barrels are allowed for type-only exports.

## 5. State and APIs

Do not mutate module state directly when a setter/controller exists.

Bad:

```typescript
getPipelineSteps().push(newStep);
```

Good:

```typescript
setPipelineSteps([...getPipelineSteps(), newStep]);
```

Prefer dependency injection via options objects over hidden cross-layer callbacks.

## 6. SolidJS Rules

- do not use comma expressions inside JSX
- prefer helper functions for signal subscription + formatting
- do not mount the same Solid root repeatedly into the same container
- exported `sync*` functions are acceptable when a parent orchestrator owns updates

Bad:

```tsx
<span>{(language(), formatLabel(param))}</span>
```

Good:

```tsx
function renderLabel(param: ParamName): string {
  language();
  return formatLabel(param);
}
```

## 7. WebGL and Browser Boundaries

Use `platforms/webgl` for:

- `WebGLRenderingContext`
- shader compile/link helpers
- texture upload helpers
- renderer classes

Use `app/browser` or `platforms/browser` for:

- `document.createElement`
- `window.devicePixelRatio`
- `localStorage`
- `File`, `Blob`, object URLs
- DOM event listeners

If a module needs both WebGL and DOM/browser APIs, split it:

- reusable WebGL runtime in `platforms/webgl`
- browser bootstrap/orchestration in `app/browser`

## 8. CPU / GPU Consistency

Preserve texel-center mapping between CPU and GPU paths.

Good:

```typescript
const uPixel = u * width - 0.5;
const vPixel = v * height - 0.5;
```

Bad:

```typescript
const uPixel = u * (width - 1);
```

## 9. File Creation Checklist

Before adding a new module:

1. decide which layer owns it
2. verify import direction is legal
3. keep browser globals out of `features`, `shared`, and `platforms/webgl`
4. keep reusable logic out of `app/browser`
5. run `npm run typecheck`
