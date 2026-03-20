# architecture.md — 層の責務と依存関係マッピング

本ドキュメントは、LUT Chainer における 3層アーキテクチャ（Domain / Rendering / UI）の責務分担と、それぞれの内部構成を記載します。

## 3層アーキテクチャ概論

```
┌─────────────────────────────────────────┐
│ UI Layer                                │
│ - SolidJS Components (solid-*.tsx)      │
│ - Event Handlers (controller.ts)        │
│ - Orchestration (main-*.ts)             │
└─────────────┬───────────────────────────┘
              │ (import)
┌─────────────┴───────────────────────────┐
│ Rendering Layer                         │
│ - WebGL Renderer                        │
│ - Shader Code Generation                │
│ - LUT Texture / GPU State Mgmt          │
└─────────────┬───────────────────────────┘
              │ (import)
┌─────────────┴───────────────────────────┐
│ Domain Layer                            │
│ - Data Models (*.ts)                    │
│ - Business Logic (*.ts)                 │
│ - State Accessors (*.ts)                │
│ - Serialization / I/O (*.ts)            │
└─────────────────────────────────────────┘
```

**重要**: 依存方向は **上 → 下 のみ** 。下の層が上の層をinportすることは禁止。

---

## Domain Layer (`src/features/`)

### 責務

- **Pure Data Structures** — `*-model.ts` で enums, constants, types を定義
- **Serialization** — JSON import/export, schema validation
- **State Snapshots** — mutable state の snapshot = immutable copy
- **Pure Algorithms** — stateless computation (色合成、blend mode calculation)
- **History / Undo** — snapshot ベースの履歴管理

### 依存関係: 他の層をinportしない ✅

```typescript
// ✅ OK: Domain 層 internal only
import type { StepModel } from '../step/step-model';
import { validateSnapshot } from './pipeline-state';
import { calculateBlendColor } from '../step/step-runtime';

// ❌ Forbidden: Domain が他の層をinport
import { Renderer } from '../../shared/rendering/renderer';  // ❌ Rendering layer
import { mountUI } from '../../shared/ui/main-setup';       // ❌ UI layer
import { Solid } from 'solid-js';                            // ❌ Framework (OK: only for types)
```

### 主要ファイル

| ファイル | 役割 | 例 |
|---------|------|-----|
| `*-model.ts` | Data schema, enums, readonly const | [step-model.ts](../../src/features/step/step-model.ts) — `BlendMode`, `StepModel`, `ParamName` |
| `*-state.ts` | Global mutable state + accessors | [pipeline-state.ts](../../src/features/pipeline/pipeline-state.ts) — `getPipelineSteps()`, `setPipelineSteps(s)`, validation |
| `*-runtime.ts` | Stateless computation | [step-runtime.ts](../../src/features/step/step-runtime.ts) — `composeColorFromSteps()`, `BLEND_MODE_STRATEGIES` |
| `*-view.ts` | UI helper types + drop indicators | [pipeline-view.ts](../../src/features/pipeline/pipeline-view.ts) — `SocketDragState`, `updateReorderDropIndicators()` |
| `types.ts` | Barrel exports of domain types | [features/pipeline/types.ts](../../src/features/pipeline/types.ts) — 他の層が import する際の main entry point |

### Module Organization: Feature Folders

```
src/features/
├─ pipeline/
│  ├─ types.ts                      ← Barrel export (import entry)
│  ├─ pipeline-model.ts             ← Data structures
│  ├─ pipeline-state.ts             ← Global state + accessors
│  ├─ pipeline-view.ts              ← UI helper types
│  ├─ pipeline-history.ts           ← Undo/redo snapshots
│  ├─ pipeline-io-system.ts         ← JSON format, ZIP import/export
│  ├─ pipeline-command-controller.ts ← Stateful command handler (DI based)
│  └─ [other coordination]
├─ step/
│  ├─ types.ts
│  ├─ step-model.ts                 ← BlendMode, ParamName, StepModel
│  ├─ step-runtime.ts               ← Color composition, param evaluation
│  ├─ lut-sampling.ts               ← CPU fallback LUT sampling
│  └─ [other step logic]
└─ shader/
   ├─ types.ts
   ├─ shader-generator.ts           ← GLSL/HLSL code gen
   ├─ shader-step-code.ts           ← Per-step code fragments
   ├─ shader-local-decls.ts         ← Uniform/sampler declarations
   └─ [other shader logic]
```

---

## Rendering Layer (`src/shared/rendering/`)

### 責務

- **WebGL Context Management** — `Renderer` が context 保持
- **Shader Compilation & Program Management** — shader gen → compile → bind
- **Texture Binding** — LUT images → WebGL textures → sampler uniforms
- **Draw Calls** — renderer frame loop update + GPU commands
- **CPU Fallback** — WebGL unavailable or step preview 時の CPU side rendering

### 依存関係

```typescript
// ✅ OK: Rendering → Domain
import type { StepModel } from '../../features/step/types';
import { composeColorFromSteps } from '../../features/step/step-runtime';
import { buildShaderFromPipeline } from '../../features/shader/shader-generator';

// ❌ Forbidden: Rendering が UI をinport
import { syncUI } from '../ui/main-setup';  // ❌
import { solid } from 'solid-js';          // ❌
```

### 主要ファイル

| ファイル | 役割 | 説明 |
|---------|------|------|
| `renderer.ts` | WebGL renderer class | `new Renderer(canvas)` → context holder; `draw(line, material)` |
| `render-system.ts` | Lifecycle manager | `createRenderSystem()` → requestAnimationFrame loop 管理 |
| `step-preview-renderer.ts` | Step sphere preview | GPU ベース preview; shader apply + read pixels |
| `step-preview-cpu-render.ts` | CPU fallback | CPU loop; `lut-sampling` + `step-runtime` で色計算 |
| `shader-generator.ts` | Shader code gen | `buildShaderFromPipeline()` → GLSL fragment code return |
| `lut-texture-utils.ts` | LUT texture binding | `applyLutTextures()` → sampler 割り当て |
| `lut-sampling.ts` | CPU LUT color fetch | `sampleLutColorLinear()` with texel-center mapping |
| `geometry.ts` | Primitive geometry gen | Sphere, cube, torus vertex data |

### WebGL ↔ CPU 実装の対応

**Goal**: 両方が同じ色を出す

| 処理 | WebGL | CPU |
|------|-------|-----|
| **LUT Color Sample** | `texture(lutSampler, uv)` (linear filtering) | `sampleLutColorLinear(lut, u, v)` with `u*w-0.5`, `v*h-0.5` |
| **Color Composition** | Shader fragment code (per-thread) | `composeColorFromSteps()` loop |
| **Blend Mode** | Custom shader blend | `BLEND_MODE_STRATEGIES[blendMode](base, color)` |
| **Parameter Sampling** | Vertex attribute interpolation | `PARAM_EVALUATORS[paramName](context)` |

---

## UI Layer (`src/shared/ui/`, `src/shared/components/`)

### 責務

- **SolidJS Component Tree** — `solid-*.tsx` で reactive UI render
- **Event Delegation** — single listener per container; event dispatch
- **State Synchronization** — domain state ← → UI signal
- **Interaction Handling** — DnD, keyboard, pointer coordination
- **DOM Orchestration** — `main-*.ts` が各UI subsystem の setup

### 依存関係

```typescript
// ✅ OK: UI → Rendering → Domain
import type { StepModel } from '../features/step/types';
import { Renderer } from './rendering/renderer';
import { createDragState } from './interactions/dnd';

// ✅ OK: Component receives DI options (callback only)
interface StepListMountOptions {
  onStepAddClick: (after: number) => void;  // Callback (no direct call)
  getSteps: () => StepModel[];
}

// ❌ Forbidden: UI が Domain state を直接import＆mutable
import { globalPipelineState } from '../features/pipeline/pipeline-state';
globalPipelineState.steps = newSteps;  // ❌ Direct mutation

// ❌ Forbidden: UI層が other UI を circular import
import { setupEditor } from './main-pipeline-editor-setup';
import { setupPreview } from './main-preview-runtime-setup';
// OK to import both in main.ts, but not each other
```

### 主要ファイル

#### Main Orchestration (`main-*.ts`)

```typescript
// src/shared/ui/main-*.ts pattern
export function setupPipelineEditor(options: EditorSetupOptions): void {
  // 1. Domain state accessors と ← → UI signal 同期
  // 2. Controller 作成 (DI 経由)
  // 3. SolidJS component mount
  // 4. Event listener binding
  // Called from main.ts
}

// Examples:
// - main-pipeline-editor-setup.ts — Pipeline editor UI + controllers
// - main-preview-runtime-setup.ts — 3D preview renderer + loop
// - main-panels-setup.ts — Left/right panel layout
// - main-dom-select.ts — DOM element queries
// - main-layout-controls-setup.ts — Camera orbit, undo/redo buttons
```

#### Components (`solid-*.tsx`)

```typescript
// src/shared/components/solid-*.tsx pattern
export function mountStepList(options: StepListMountOptions): () => void {
  // SolidJS root は 1回のみ mount
  // 返却: sync 関数（後で domain state 変更時に呼び出される）
  
  return (stepModels: StepModel[], lutModels: LutModel[]) => {
    setSteps(stepModels);
    setLuts(lutModels);
  };
}

export function StepList(props: StepListProps): JSX.Element {
  const [steps, setSteps] = createSignal<StepModel[]>([]);
  
  // ✅ Exported for parent orchestrator to call
  window.syncStepList = (s: StepModel[]) => setSteps(s);
  
  return <For each={steps()}>{step => <StepItem step={step} />}</For>;
}
```

#### Controllers (`*-controller.ts`)

```typescript
// src/features/pipeline/pipeline-command-controller.ts
export interface PipelineCommandControllerOptions {
  getSteps: () => StepModel[];
  setSteps: (steps: StepModel[]) => void;
  getLuts: () => LutModel[];
  setLuts: (luts: LutModel[]) => void;
  onStepLabelChange: (stepId: number, label: string) => void;
  status: (message: string, kind?: StatusKind) => void;
  t: (key: unknown, params?: TemplateValues) => string;
  // ... more callbacks
}

export interface PipelineCommandController {
  addStep(after: number): void;
  duplicateStep(stepId: number): void;
  deleteStep(stepId: number): void;
  moveStepToPosition(stepId: number, position: number): void;
  // ... more commands
}

export function createPipelineCommandController(
  options: PipelineCommandControllerOptions,
): PipelineCommandController {
  // Returns controller object with bound callbacks
  return { addStep, duplicateStep, ... };
}
```

#### Interactions (`interactions/*.ts`)

```typescript
// DnD, socket validation, keyboard binding
// src/shared/interactions/

| File | Role |
|------|------|
| dnd.ts | Generic pointer drag binding |
| socket-dnd.ts | Socket parameter connection DnD |
| socket-validation.ts | Type guards for socket drag state |
| keyboard-history.ts | Undo/redo keyboard shortcuts |
| layout-interactions.ts | Orbit camera control |

// All export factory/setup functions (no Solid)
export function bindPointerDragSources(options: ...): void { }
export function resolveSocketDropTarget(state: SocketDragState): ... { }
```

---

## Dependency Injection Pattern (DI = Options Object)

### Philosophy

> 層間のデカップリングを実現するため、mutable state への direct import ±を避け、**options object 経由で callback/accessor を inject** する。

### Pattern: Command Controller

```typescript
// ❌ Bad: Direct state import (circular + tight coupling)
import { globalState } from './state';

export function processAddStep(): void {
  globalState.steps.push(newStep);  // Direct mutation
  globalState.notifyUI();            // UI callback に依存
}

// ✅ Good: DI via options
export interface ProcessAddStepOptions {
  getSteps: () => StepModel[];
  setSteps: (steps: StepModel[]) => void;
  onStepAdded: (stepId: number) => void;
  status: (message: string) => void;
}

export function createAddStepHandler(options: ProcessAddStepOptions) {
  return {
    execute(afterStepId: number) {
      const steps = options.getSteps();
      const newSteps = [...steps, newStep];
      options.setSteps(newSteps);  // Setter call
      options.onStepAdded(newStep.id);  // Callback
      options.status(`Step added`);
    },
  };
}

// Caller (main.ts):
const handler = createAddStepHandler({
  getSteps: () => getPipelineSteps(),
  setSteps: setPipelineSteps,
  onStepAdded: (id) => syncUI(),
  status: (msg) => statusDisplay.show(msg),
});

handler.execute(afterId);
```

### Benefits

| 面 | 効果 |
|----|------|
| **Testability** | Mock options を inject して unit test 可能 |
| **Flow Visibility** | どの controller が何を call するかが明らか |
| **Circular Dependency Prevention** | Getter/setter accessor 経由で間接化 |
| **Layer Decoupling** | Domain logic が UI/Rendering を知らない |

---

## State Management Pattern

### 3つの状態パターン

#### 1. Global Domain State (pipeline-state.ts)

```typescript
// ✅ Domain layer: Single source of truth
let _pipelineSnapshot: PipelineStateSnapshot = DEFAULT_SNAPSHOT;

export function getPipelineSteps(): StepModel[] {
  return _pipelineSnapshot.steps;
}

export function setPipelineSteps(steps: StepModel[]): void {
  _pipelineSnapshot = {
    ..._pipelineSnapshot,
    steps,
  };
  // No notification here — upstream caller handles it
}
```

#### 2. Local UI Signal (SolidJS component)

```typescript
// ✅ UI layer: SolidJS component-local signal
export function StepList(props: StepListProps) {
  const [steps, setSteps] = createSignal<StepModel[]>(props.initialSteps);
  const [editingId, setEditingId] = createSignal<number | null>(null);
  
  // Exported for parent orchestrator
  window.syncStepListState = (newSteps: StepModel[]) => {
    setSteps(newSteps);
  };
  
  return <For each={steps()}>{/* ... */}</For>;
}
```

#### 3. Transient Interaction State (interaction-state.ts)

```typescript
// ✅ UI layer: Temporary drag/selection state
let _dragState: SocketDragState | null = null;

export function getCurrentDragState(): SocketDragState | null {
  return _dragState;
}

export function setDragState(state: SocketDragState | null): void {
  _dragState = state;
  updateDropIndicators(state);  // Side effect
}
```

### Data Flow

```
main.ts (orchestrator)
  ↓
  ├─→ createPipelineCommandController(DI options)
  │   ├─ getSteps, setSteps → Domain accessors
  │   ├─ onStepAdded → UI callback
  │   └─ status → Status bar callback
  ├─→ mountStepList(DI options)  → SolidJS render + sync*
  └─→ renderSystem.start()

User interaction (click, drag, etc.)
  ↓
  controller.addStep()
  ├─ calls setSteps() → Domain state update
  ├─ calls onStepAdded() → UI callback
  └─ Main loop detects change → syncStepListUI(getSteps()) call

SolidJS signal update
  ↓
  Component re-render
```

---

## Module Dependency Matrix

```
┌────────────────────────────────────────────────────┐
│ UI Layer (shared/ui, shared/components)            │
├────────────────────────────────────────────────────┤
│ Depends on: Rendering + Domain + interactions      │
│ main-*.ts, solid-*.tsx, *-controller.ts            │
└──────────────┬───────────────────────────────────┘
               │ import
┌──────────────┴───────────────────────────────────┐
│ Rendering Layer (shared/rendering)                │
├──────────────────────────────────────────────────┤
│ Depends on: Domain only (features/*)              │
│ renderer.ts, shader-generator.ts, render-system  │
└──────────────┬───────────────────────────────────┘
               │ import
┌──────────────┴───────────────────────────────────┐
│ Domain Layer (features/pipeline, step, shader)    │
├──────────────────────────────────────────────────┤
│ Depends on: Nothing (pure logic)                  │
│ *-model.ts, *-state.ts, *-runtime.ts              │
└──────────────────────────────────────────────────┘
```

### Explicit Dependency Prohibition

| From | To | Status | Reason |
|------|-----|--------|--------|
| Domain | Rendering | ❌ No | Domain は layer-agnostic |
| Domain | UI | ❌ No | Circular dep risk |
| Rendering | UI | ❌ No | Rendering はframework-agnostic |
| Rendering | Domain | ✅ Yes | Rendering uses domain logic |
| UI | Rendering | ✅ Yes | UI orchestrates rendering |
| UI | Domain | ✅ Yes | UI uses domain accessors |

---

## Best Practices Summary

- [ ] **Domain 層は独立** — Framework や他の層に依存しない
- [ ] **DI Pattern** — 層間通信は callback/accessor 経由
- [ ] **State Accessors** — direct state import ×、getter/setter ✓
- [ ] **Signal + Sync** — SolidJS はlocal signal、parent から sync*() call
- [ ] **Data Flow: UI → Controllers → Domain State** — 一方向
- [ ] **Circular Imports** — 絶対禁止（DI で回避）
- [ ] **Type Safety** — `types.ts` は barrel export で import entry point

