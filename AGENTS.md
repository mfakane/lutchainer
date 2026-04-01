# AGENTS.md

This document provides guidance to AI agents (GitHub Copilot, custom agents, etc.) when working with code in this repository.

---

## 🛠️ Development Commands

```bash
# Build (outputs to dist/bundle.js)
npm run build

# Watch mode (rebuild on file changes)
npm run dev

# Type check only (no emit)
npx tsc --noEmit
```

There are no tests or linting configured. Use `npx tsc --noEmit` to validate TypeScript before committing.

Run the app via a local static server after building:

```bash
npm run build
npm run serve
# http://localhost:8000
```

Do not assume `file://` opening of `index.html` is sufficient. Example preset loading depends on HTTP serving.

---

# LUT Chainer AI Agent Guide

This document provides design guidance to AI Agents (GitHub Copilot, custom agents, etc.) working with the LUT Chainer project, enabling them to provide accurate assistance.

## 📋 Project Overview

**LUT Chainer** is a browser-based shader editor for creating LUT (Look-Up Table) based step chains.

### Key Features

- **LUT Step Chain Editing** — Combine multiple LUTs and blend modes sequentially
- **Real-time 3D Preview** — WebGL + CPU fallback for visual adjustment
- **Material / Light Parameter Controls** — Light source and material settings
- **Generated Code Display** — Auto-generate GLSL / HLSL code
- **Pipeline Save & Load** — JSON + embedded LUT images (ZIP format)

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Language** | TypeScript (ES2020, strict) | Type-safe development |
| **UI Framework** | SolidJS | Reactive components |
| **Build** | esbuild + TypeScript | Fast bundling |
| **Graphics** | WebGL 1.0 + CPU fallback | 3D rendering |
| **Compression** | fflate | ZIP export |
| **i18n** | Custom i18n system | ja/en support |

---

## 🏗️ Architecture: 3-Layer Structure

```
┌──────────────────────────────────────────────────────┐
│ UI Layer (shared/ui, shared/components)              │
│ - SolidJS components (solid-*.tsx)                   │
│ - Controllers (main-*-setup.ts, *-controller.ts)     │
│ - Event delegation (DnD, keyboard, pointer)          │
└─────────────────────┬──────────────────────────────┘
                      │
┌─────────────────────┴──────────────────────────────┐
│ Rendering Layer (shared/rendering)                  │
│ - WebGL Renderer + shader generation                │
│ - LUT texture management                            │
│ - CPU fallback rendering                            │
└─────────────────────┬──────────────────────────────┘
                      │
┌─────────────────────┴──────────────────────────────┐
│ Domain Layer (features/[pipeline|step|shader])      │
│ - Data models & serialization                       │
│ - Business logic (composition, blending)            │
│ - State snapshots & validation                      │
└──────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Role | Key Files |
|-------|------|-----------|
| **Domain (features/)** | Pure data + logic; IO serialization | `*-model.ts`, `*-state.ts`, `*-runtime.ts` |
| **Rendering (shared/rendering/)** | WebGL context + shader generation + CPU fallback | `renderer.ts`, `shader-generator.ts`, `lut-texture-utils.ts` |
| **UI (shared/ui, shared/components)** | DOM coordination + event handling + SolidJS mounts | `main-*.ts`, `solid-*.tsx`, `*-controller.ts` |

**Important**: Dependencies flow upward only (UI → Rendering → Domain). Domain layer has no external dependencies.

---

## 📛 File Naming Conventions & Roles

When creating new files, follow these naming patterns (strictly):

| Pattern | Example | Role |
|---------|---------|------|
| `*-model.ts` | `pipeline-model.ts`, `step-model.ts` | **Data structures, enums, constants** — Immutable schema definitions |
| `*-state.ts` | `pipeline-state.ts`, `interaction-state.ts` | **Mutable state with accessors** — getter/setter + validation |
| `*-runtime.ts` | `step-runtime.ts` | **Pure computation logic** — Stateless algorithms |
| `*-controller.ts` | `pipeline-command-controller.ts`, `gizmo-overlay-controller.ts` | **Stateful event handlers** — `create*` factory returns controller object |
| `*-bindings.ts` | `pipeline-dnd-bindings.ts` | **Event wiring + DnD setup** — Pure configuration, no state |
| `*-view.ts` | `pipeline-view.ts` | **UI state + helpers** — Drop indicators, drag state |
| `*-system.ts` | `step-preview-system.ts`, `render-system.ts` | **Lifecycle manager** — Init, update, cleanup |
| `solid-*.tsx` | `solid-pipeline-lists.tsx`, `solid-shader-dialog.tsx` | **SolidJS components** — Export `mount*` function |
| `main-*.ts` | `main-pipeline-editor-setup.ts`, `main-orbit-state.ts` | **UI orchestrators** — Called from `main.ts`, coordinate setup |
| `types.ts` | `features/pipeline/types.ts`, `features/step/types.ts` | **Barrel exports** — Re-export types from `*-model.ts`, `*-state.ts` |

---

## ⚡ Core Rules (AI Agent Critical)

### Rule 1: No Layer Violations 🚫

❌ **Bad**: Domain imports from `shared/rendering/` or `shared/ui/`
❌ **Bad**: Rendering layer imports SolidJS components

✅ **Good**:
```typescript
// Domain: Pure logic only
export function composeColorFromSteps(steps: readonly StepRuntimeModel[]): Color { ... }

// UI imports Domain:
import { composeColorFromSteps } from '../features/step/step-runtime';
```

### Rule 2: State Access via Getter/Setter Only 🔒

❌ **Bad**:
```typescript
// Direct mutable import
import { globalPipelineState } from './pipeline-state';
globalPipelineState.steps = newSteps;  // ❌ Direct mutation

// Domain knowing about UI callbacks
import { updateUI } from '../ui/main-setup';
updateUI();  // ❌ Circular dependency risk
```

✅ **Good** — Dependency Injection via Options:
```typescript
const controller = createPipelineCommandController({
  getSteps: () => getPipelineSteps(),
  setSteps: (s) => setPipelineSteps(s),
  status: (msg, kind) => statusDisplay.show(msg, kind),
  t: (key) => translate(key),
});
// UI calls controller.addStep(), deleteStep(), etc.
```

### Rule 3: SolidJS JSX Restrictions ⚠️

❌ **Bad** — Comma operator not allowed:
```typescript
<span>{(language(), formatParam(param))}</span>  // ❌ SolidJS error
```

✅ **Good** — Use helper function:
```typescript
function tr(param: ParamName): string {
  _language();  // Signal subscription
  return formatParam(param);
}
<span>{tr(param)}</span>  // ✅
```

### Rule 4: TypeScript Strict Mode + Type Inference 🎯

**Strict Flags** (`tsconfig.json`):
- `strict: true` — All flags enabled
- `jsx: preserve` + `jsxImportSource: "solid-js"` — SolidJS mode
- `target: ES2020` — `String.replaceAll()` forbidden (use regex instead)

❌ **Bad** — Generic inference too broad:
```typescript
const controller = createController(options);  // unknown: TS7006 implicit-any
```

✅ **Good** — Explicit type arguments:
```typescript
const controller = createController<PipelineCommandControllerOptions>(options);
```

### Rule 5: CPU ↔ GPU Rendering Consistency 🎨

**LUT Sampling**: CPU fallback and WebGL must return identical colors.

✅ **Texel-center mapping** (unified in both):
```typescript
// CPU: lut-sampling.ts
const u_pixel = u * width - 0.5;   // ✅ Texel center
const v_pixel = v * height - 0.5;

// WebGL: Linear filtering (hardware-handled automatically)
```

❌ **Bad** — `u * (width - 1)` causes visible color mismatches

---

## 🚫 Anti-Patterns to Avoid (5 Critical)

### 1. Relative Path Errors (`../src` Forbidden)

**Context**: After folder restructuring, `src/` is the import base.
**Bad**: `import { helper } from '../shared/utils'`
**Good**: `import { helper } from './shared/utils'` or `import { helper } from '../features/step/...'`

**Rule**: Assume modules live under `src/features` or `src/shared`. Start relative paths with `.` or `..`.

---

### 2. DOM Selector Brittleness with Special Characters

**Context**: Dynamic IDs like `data-lut-id` with special characters break CSS selectors

**Bad**:
```typescript
const element = document.querySelector(`[data-lut-id="${lutId}"]`);
// If lutId contains quotes or brackets → Selector breaks
```

**Good** — Direct comparison:
```typescript
const elements = document.querySelectorAll('[data-lut-id]');
Array.from(elements).find(el => el.dataset.lutId === lutId);
```

---

### 3. Generic Call with Overly Broad Union Type

**Context**: Options object callback type inference

**Bad**:
```typescript
function createController(options: { onStatusChange: (msg: unknown) => void }) {
  options.onStatusChange(123);  // ✅ Compiles, but (msg: string) expected
}
```

**Good** — Explicit annotation:
```typescript
interface Options {
  onStatusChange: (msg: string, kind: StatusKind) => void;
}
```

---

### 4. No createEffect in Render Path (SolidJS Anti-Pattern)

**Context**: SolidJS is signal-driven; createEffect is for side effects only

**Bad**:
```typescript
const [steps, setSteps] = createSignal(initialSteps);
createEffect(() => {
  // Render every time steps change → Performance issue
  renderPreview();
});
```

**Good** — Parent orchestrator calls sync:
```typescript
// UI layer (main.ts):
const steps = getPipelineSteps();
syncStepListUI(steps);  // Exported from solid-pipeline-lists.tsx

// solid-pipeline-lists.tsx:
export function syncStepListUI(newSteps: StepModel[]): void {
  setSteps(newSteps);  // Signal update → Auto re-render
}
```

---

### 5. Type Guard vs Runtime Validation

**Context**: Runtime validation requires both TS type guard AND runtime check

**Bad**:
```typescript
import type { PipelineStateSnapshot } from './types';
const snapshot: PipelineStateSnapshot = JSON.parse(data);  // ❌ No validation
```

**Good** — Type guard + asserting guard:
```typescript
function isPipelineStateSnapshot(value: unknown): value is PipelineStateSnapshot {
  return typeof value === 'object' && value !== null
    && 'steps' in value && Array.isArray((value as any).steps)
    && 'material' in value && isValidMaterialSettings((value as any).material);
}

function assertPipelineStateSnapshot(value: unknown): asserts value is PipelineStateSnapshot {
  if (!isPipelineStateSnapshot(value)) {
    throw new Error(`Invalid snapshot: expected PipelineStateSnapshot`);
  }
}

const snapshot = JSON.parse(data);
assertPipelineStateSnapshot(snapshot);  // ✅ Now type-safe
```

---

## 📁 Directory Structure (Reference)

```
lutchainer/
├─ AGENTS.md                    ← You are here
├─ .claude/rules/
│  ├─ coding-style.md           ← TypeScript + SolidJS conventions
│  ├─ common-mistakes.md        ← Runtime edge cases & fixes
├─ src/
│  ├─ main.ts                   ← Entry point; UI orchestration
│  ├─ features/
│  │  ├─ pipeline/              ← LUT composition pipeline
│  │  ├─ step/                  ← Step color processing
│  │  └─ shader/                ← GLSL/HLSL generation
│  └─ shared/
│     ├─ components/            ← SolidJS component tree
│     ├─ rendering/             ← WebGL renderer + utilities
│     ├─ interactions/          ← DnD, keyboard, socket
│     ├─ ui/                    ← UI setup orchestrators
│     └─ i18n/                  ← Translations + locale system
├─ package.json
├─ tsconfig.json
└─ scripts/
   └─ build.mjs
```

---

## 🔗 Quick Reference: Detailed Guides

Specialized guidance is available in `.claude/rules/`:

- **TypeScript strictness, SolidJS JSX constraints, file structure** → `.claude/rules/coding-style.md`
- **CPU↔GPU mismatch, type inference traps, edge cases** → `.claude/rules/common-mistakes.md`

---

## ✅ Before You Code

**Checklist for AI Agents**

- [ ] Understand 3-layer architecture (Domain/Rendering/UI)
- [ ] Review file naming conventions (`*-model`, `*-state`, `*-controller`, etc.)
- [ ] Confirm relative import paths don't use `../src`
- [ ] Understand SolidJS signal pattern (no createEffect needed)
- [ ] Verify dependency direction: Domain → Rendering → UI
- [ ] Ensure CPU ↔ GPU color consistency with texel-center mapping

If any of the above are unclear, refer to detailed guides before implementing.

---

## 🐱 Final Notes

This project has **strict design requirements**. TS strict mode, layer separation, and type safety are non-negotiable. When adding new features, follow these architectural patterns first. Always choose the "right way" over the "easy way".

Questions? Consult this document and `.claude/rules/` before implementing.

