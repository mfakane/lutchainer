# patterns.md — 実装パターンと具体例

本ドキュメントは、LUT Chainer で頻出する設計パターンと、その正しい使い方を記載します。

## 1. SolidJS Signal + Sync Export Pattern

### Problem
SolidJS component は local signal で状態を管理しますが、親の orchestrator が domain state 変更を検出して UI に反映する必要があります。

### Solution: Exported Sync Function

#### Pattern

```typescript
// src/shared/components/solid-pipeline-lists.tsx
import { createSignal, For } from 'solid-js';
import type { StepModel, LutModel } from '../../features/pipeline/types';

interface StepListProps {
  initialSteps: StepModel[];
  initialLuts: LutModel[];
  onAddClick: () => void;
}

export function StepList(props: StepListProps): JSX.Element {
  // Local signals
  const [steps, setSteps] = createSignal<StepModel[]>(props.initialSteps);
  const [luts, setLuts] = createSignal<LutModel[]>(props.initialLuts);

  // ✅ EXPORTED SYNC FUNCTION (for parent to call later)
  window.syncStepListState = (newSteps: StepModel[], newLuts: LutModel[]) => {
    setSteps(newSteps);
    setLuts(newLuts);
  };

  return (
    <div class="step-list">
      <For each={steps()}>
        {(step) => <StepItem step={step} />}
      </For>
    </div>
  );
}
```

#### Parent Orchestrator

```typescript
// src/shared/ui/main-pipeline-editor-setup.ts
import { render } from 'solid-js/web';
import { StepList } from '../components/solid-pipeline-lists';
import { getPipelineSteps, getPipelineLuts, setPipelineSteps } from '../../features/pipeline/pipeline-state';

let syncStepListState: ((steps: StepModel[], luts: LutModel[]) => void) | null = null;

export function setupPipelineEditor(): void {
  const container = document.getElementById('step-list-container')!;

  // Mount component
  render(
    () => (
      <StepList
        initialSteps={getPipelineSteps()}
        initialLuts={getPipelineLuts()}
        onAddClick={handleAddStep}
      />
    ),
    container,
  );

  // Capture exported sync function (defined in component render)
  // In real code, this is done via callback or prop setter
  // For now, assume window.syncStepListState is available
}

function handleAddStep(): void {
  const steps = getPipelineSteps();
  const newSteps = [...steps, newStep];
  setPipelineSteps(newSteps);
  
  // ✅ Trigger UI update via sync function
  if (window.syncStepListState) {
    window.syncStepListState(newSteps, getPipelineLuts());
  }
}

// Main render loop or event listener
export function onPipelineStateChange(): void {
  const steps = getPipelineSteps();
  const luts = getPipelineLuts();
  if (window.syncStepListState) {
    window.syncStepListState(steps, luts);
  }
}
```

### Why This Pattern

| 理由 | 詳細 |
|------|------|
| **Solid.js Reactive** | signal 更新が automatic re-render trigger |
| **Parent Orchestration** | main.ts で domain state → UI signal の flow 管理 |
| **Type Safe** | Props + sync function の型が明確 |
| **No createEffect** | createEffect は不要（parent が timing 制御） |

### Anti-Pattern: createEffect in Render

```typescript
// ❌ Bad: createEffect でrendering cost が増加
export function StepList(props: StepListProps): JSX.Element {
  const [steps, setSteps] = createSignal(props.initialSteps);

  createEffect(() => {
    // ❌ Every signal change triggers side effect
    setSteps(props.initialSteps);  // Circular update
    renderExpensivePreview();       // GPU cost
  });

  return <For each={steps()}>{/**/}</For>;
}
```

---

## 2. Validation: Type Guard + Asserting Guard Pattern

### Problem
Runtime JSON data は `unknown` 型；TS type: `as Type` cast だけでは実行時チェック なし。

### Solution: Type Predicate + Asserting Guard

#### Pattern

```typescript
// src/features/pipeline/pipeline-state.ts
import type { PipelineStateSnapshot } from './types';
import type { StepModel } from '../step/types';

// ✅ Type Guard: returns boolean
export function isPipelineStateSnapshot(value: unknown): value is PipelineStateSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.steps) &&
    isStepsArray(obj.steps) &&
    typeof obj.undoHistory === 'number' &&
    typeof obj.material === 'object' &&
    isValidMaterialSettings(obj.material)
  );
}

function isStepsArray(value: unknown): value is StepModel[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        typeof (item as any).id === 'number' &&
        typeof (item as any).label === 'string',
    )
  );
}

// ✅ Asserting Guard: throws error
export function assertPipelineStateSnapshot(
  value: unknown,
  label = 'Pipeline Snapshot',
): asserts value is PipelineStateSnapshot {
  if (!isPipelineStateSnapshot(value)) {
    throw new Error(
      `${label} が不正です。expected PipelineStateSnapshot, got ${JSON.stringify(value).slice(0, 100)}...`,
    );
  }
}
```

#### Usage

```typescript
// Load from JSON
const data = JSON.parse(jsonString);  // data: unknown
assertPipelineStateSnapshot(data, 'Imported snapshot');  // Throws if invalid
// Now data has type PipelineStateSnapshot ✓

// Undo/redo
export function commitSnapshot(before: PipelineStateSnapshot): boolean {
  const after = captureSnapshot();
  assertPipelineStateSnapshot(after, 'Current snapshot');  // Safety check
  
  undoStack.push(before);
  currentSnapshot = after;
  return true;
}
```

### Socket Validation Example

```typescript
// src/shared/interactions/socket-validation.ts
export type SocketDragState =
  | { mode: 'param'; param: ParamName }
  | { mode: 'step'; stepId: number; axis: SocketAxis };

export function isValidSocketDragState(value: unknown): value is SocketDragState {
  if (typeof value !== 'object' || !value) return false;
  
  const obj = value as any;
  if (obj.mode === 'param') {
    return typeof obj.param === 'string' && isValidParamName(obj.param);
  }
  if (obj.mode === 'step') {
    return (
      typeof obj.stepId === 'number' &&
      typeof obj.axis === 'string' &&
      (obj.axis === 'x' || obj.axis === 'y')
    );
  }
  return false;
}

export function assertValidSocketDragState(
  value: unknown,
): asserts value is SocketDragState {
  if (!isValidSocketDragState(value)) {
    throw new Error(`Invalid socket drag state: ${JSON.stringify(value)}`);
  }
}
```

---

## 3. Dependency Injection: Options Object Pattern

### Problem
Layers between domain logic and UI need callbacks, but direct imports cause tight coupling.

### Solution: Options Object with Setter/Getter/Callback

```typescript
// src/features/pipeline/pipeline-command-controller.ts
export interface PipelineCommandControllerOptions {
  // ✅ Getters: Read domain state
  getSteps: () => StepModel[];
  getLuts: () => LutModel[];
  getHistory: () => PipelineHistory;
  
  // ✅ Setters: Write domain state
  setSteps: (steps: StepModel[]) => void;
  setLuts: (luts: LutModel[]) => void;
  
  // ✅ Callbacks: Notify UI changes
  onStepLabelChange: (stepId: number, label: string) => void;
  onLutOrderChange: (lutIds: string[]) => void;

  // ✅ Services: Status, translation
  status: (message: string, kind?: StatusKind) => void;
  t: (key: unknown, params?: TemplateValues) => string;
}

export interface PipelineCommandController {
  addStep(afterStepId: number): void;
  deleteStep(stepId: number): void;
  duplicateStep(stepId: number): void;
  moveLutToPosition(lutId: string, position: number): void;
  setStepLabel(stepId: number, label: string): void;
  importSnapshot(snapshot: PipelineStateSnapshot): void;
}

export function createPipelineCommandController(
  options: PipelineCommandControllerOptions,
): PipelineCommandController {
  return {
    addStep(afterStepId) {
      const steps = options.getSteps();
      const newSteps = [
        ...steps.slice(0, afterStepId + 1),
        newStep,
        ...steps.slice(afterStepId + 1),
      ];
      options.setSteps(newSteps);
      options.status(`Step added`, 'success');
    },

    setStepLabel(stepId, label) {
      const steps = options.getSteps().map((s) =>
        s.id === stepId ? { ...s, label } : s,
      );
      options.setSteps(steps);
      options.onStepLabelChange(stepId, label);
    },

    importSnapshot(snapshot) {
      assertPipelineStateSnapshot(snapshot);  // Validation
      options.setSteps(snapshot.steps);
      options.setLuts(snapshot.luts);
      // ... set material, light, etc.
      options.status(`Pipeline imported`, 'success');
    },
  };
}
```

#### Caller (main.ts)

```typescript
// src/main.ts
const controller = createPipelineCommandController({
  getSteps: () => getPipelineSteps(),
  setSteps: setPipelineSteps,
  getLuts: () => getPipelineLuts(),
  setLuts: setPipelineLuts,
  getHistory: () => getPipelineHistory(),
  onStepLabelChange: (stepId, label) => {
    syncStepListUI(getPipelineSteps());
    syncHistoryUI();
  },
  onLutOrderChange: (lutIds) => syncLutStripUI(getPipelineLuts()),
  status: (message, kind) => statusBar.show(message, kind),
  t: (key, params) => translate(key as string, params),
});

// UI event: User clicks "Add Step"
document.getElementById('add-step-btn')?.addEventListener('click', () => {
  const currentSteps = getPipelineSteps();
  const After = currentSteps.length - 1;
  controller.addStep(After);
});
```

### Benefits

| 面 | 効果 |
|----|------|
| **Decoupling** | Controller が specific UI を知らない |
| **Testability** | Mock options を inject
| **Flow Visibility** | どの operation が何をcall するか明確 |
| **Serialization** | Domain logic が I/O format を知らない |

---

## 4. Event Delegation Pattern (Pointer Drag)

### Problem
100 個の drag source を個別に listener attach = memory 浪費、performance 低下。

### Solution: Single Parent Listener + Event Target Resolution

```typescript
// src/shared/interactions/dnd.ts
export interface PointerDragSourceBindingOptions<TSeed, TState> {
  container: HTMLElement;  // Single listener here
  resolveSeed: (target: Element) => TSeed | null;  // What to drag?
  resolveDropTarget: (state: TState, ev: PointerEvent) => TState;  // Where can drop?
  commitDrop: (state: TState) => void;  // Drop happened
  onCancel: () => void;  // Escape or other cancel
}

export function bindPointerDragSources<TSeed, TState>(
  options: PointerDragSourceBindingOptions<TSeed, TState>,
): void {
  let dragState: TState | null = null;

  // ✅ Single pointerdown listener on container
  options.container.addEventListener('pointerdown', (ev) => {
    const seed = options.resolveSeed(ev.target as Element);
    if (!seed) return;  // Not a drag source

    dragState = createDragStateFromSeed(seed);

    // ✅ pointermove updates drop target
    document.addEventListener('pointermove', onPointerMove);
    // ✅ pointerup commits drop or cancels
    document.addEventListener('pointerup', onPointerUp);
  });

  function onPointerMove(ev: PointerEvent) {
    if (!dragState) return;
    dragState = options.resolveDropTarget(dragState, ev);
    updateDropIndicators(dragState);  // Visual feedback
  }

  function onPointerUp(ev: PointerEvent) {
    if (!dragState) return;
    options.commitDrop(dragState);
    dragState = null;
    cleanup();
  }

  function cleanup() {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  }
}
```

### Usage: Step Reorder

```typescript
// src/features/pipeline/pipeline-dnd-bindings.ts
export function setupStepReorderBindings(options: SetupStepReorderBindingsOptions): void {
  bindPointerDragSources<StepModel, StepReorderDragState>({
    container: options.stepListContainer,

    // Identify what's being dragged
    resolveSeed(target) {
      const stepEl = (target as HTMLElement).closest('[data-step-id]');
      if (!stepEl) return null;
      const stepId = Number(stepEl.getAttribute('data-step-id'));
      const step = options.getSteps().find((s) => s.id === stepId);
      return step || null;
    },

    // Update over which step we're hovering
    resolveDropTarget(state, ev) {
      const overEl = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement;
      const overStepEl = overEl.closest('[data-step-id]');
      const overStepId = overStepEl ? Number(overStepEl.getAttribute('data-step-id')) : null;
      return {
        draggedStep: state.draggedStep,
        overStepId,  // Updated
        dropAfter: isHoveringLowerHalf(ev),
      };
    },

    // Execute move
    commitDrop(state) {
      const fromIdx = options.getSteps().findIndex((s) => s.id === state.draggedStep.id);
      const toIdx = options.getSteps().findIndex((s) => s.id === state.overStepId) +
        (state.dropAfter ? 1 : 0);
      options.reorderSteps(fromIdx, toIdx);
      options.status(`Step moved`);
    },

    onCancel: () => {
      clearDropIndicators();
    },
  });
}
```

### Benefits

| 面 | 効果 |
|----|------|
| **Memory** | N listeners → 1 listener |
| **Flexibility** | Drop target logic は configurable |
| **Clean State** | dragState は local; no global pollution |

---

## 5. CPU ↔ GPU Rendering Fallback

### Problem
GPU failures (WebGL unavailable, step preview in UI) → CPU fallback で同じ色を出す必要。

### Solution: Shared Runtime Model + CPU/GPU Implementation

```typescript
// src/features/step/step-runtime.ts (shared)
export type ParamName = 'x' | 'y' | 'scale' | /* ... */;

export interface StepParamContext {
  meshPosition: [number, number, number];
  normal: [number, number, number];
  uv: [number, number];
  // ... other context
}

export const PARAM_EVALUATORS: Record<
  ParamName,
  (context: StepParamContext) => number
> = {
  x: (ctx) => ctx.meshPosition[0],
  y: (ctx) => ctx.meshPosition[1],
  scale: (ctx) => ctx.normal[2],
  // ...
};

export type BlendMode = 'multiply' | 'screen' | 'overlay' | /* ... */;

export interface BlendModeStrategy {
  blend: (base: Color, color: Color) => Color;
}

export const BLEND_MODE_STRATEGIES: Record<
  BlendMode,
  BlendModeStrategy
> = {
  multiply: {
    blend: (base, color) => [
      base[0] * color[0],
      base[1] * color[1],
      base[2] * color[2],
    ],
  },
  // ...
};

// ✅ Pure computation: used by GPU fragment code AND CPU
export function composeColorFromSteps(
  stepModels: readonly StepRuntimeModel[],
  baseColor: Color,
  context: StepParamContext,
): Color {
  let result = baseColor;
  for (const step of stepModels) {
    const lut = step.lut;
    const param = step.paramName;
    const blendMode = step.blendMode;

    // Evaluate parameter (GPU: interpolation, CPU: callback)
    const paramValue = PARAM_EVALUATORS[param](context);

    // Sample LUT (GPU: texture(), CPU: sampleLutColorLinear())
    const lutColor = sampleLutColor(lut, paramValue);

    // Blend (GPU: custom blend, CPU: BLEND_MODE_STRATEGIES)
    result = BLEND_MODE_STRATEGIES[blendMode].blend(result, lutColor);
  }
  return result;
}
```

#### GPU Path

```typescript
// src/shared/rendering/step-preview-renderer.ts
export class StepPreviewRenderer {
  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.program = this.compileShader(buildShaderFromPipeline(steps));
  }

  render(steps: StepModel[]): ImageData {
    // GPU: composeColorFromSteps() は shader code に展開
    // - PARAM_EVALUATORS → vertex interpolation
    // - LUT sample → texture() call
    // - BLEND_MODE_STRATEGIES → custom blend
    
    const canvas = /* ... */;
    this.gl.drawArrays(/* ... */);
    return this.gl.readPixels(/* ... */);
  }
}
```

#### CPU Path

```typescript
// src/features/step/step-preview-cpu-render.ts
export function cpuRenderStepPreview(
  steps: StepRuntimeModel[],
  outputWidth: number,
  outputHeight: number,
): ImageData {
  const pixels = new Uint8ClampedArray(outputWidth * outputHeight * 4);

  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const context: StepParamContext = {
        meshPosition: computePosition(x, y),
        uv: [x / outputWidth, y / outputHeight],
        // ...
      };

      // ✅ Same composition function
      const color = composeColorFromSteps(
        steps,
        [1, 1, 1],  // baseColor
        context,
      );

      const pixelIdx = (y * outputWidth + x) * 4;
      pixels[pixelIdx] = colorToUint8(color[0]);
      pixels[pixelIdx + 1] = colorToUint8(color[1]);
      pixels[pixelIdx + 2] = colorToUint8(color[2]);
      pixels[pixelIdx + 3] = 255;
    }
  }

  return new ImageData(pixels, outputWidth, outputHeight);
}
```

#### LUT Sampling (Critical: Texel-Center Mapping)

```typescript
// src/features/step/lut-sampling.ts — CPU
export function sampleLutColorLinear(lut: LutModel, u: number, v: number): Color {
  // ✅ Texel-center mapping: required to match WebGL linear filtering
  const uPixel = u * lut.width - 0.5;
  const vPixel = v * lut.height - 0.5;

  // Bilinear interpolation
  const x0 = Math.floor(uPixel);
  const x1 = x0 + 1;
  const y0 = Math.floor(vPixel);
  const y1 = y0 + 1;

  const fx = uPixel - x0;
  const fy = vPixel - y0;

  const c00 = getLutPixel(lut, clamp(x0, lut.width), clamp(y0, lut.height));
  const c10 = getLutPixel(lut, clamp(x1, lut.width), clamp(y0, lut.height));
  const c01 = getLutPixel(lut, clamp(x0, lut.width), clamp(y1, lut.height));
  const c11 = getLutPixel(lut, clamp(x1, lut.width), clamp(y1, lut.height));

  const c0 = blend(c00, c10, fx);
  const c1 = blend(c01, c11, fx);
  return blend(c0, c1, fy);
}

// ✅ GPU fragment shader (hardware handles texel-center automatically)
// uniform sampler2D lutSampler;
// vec4 lutColor = texture(lutSampler, uv);  // Built-in linear filtering
```

### Benefits

| 面 | 効果 |
|----|------|
| **Color Consistency** | CPU ↔ GPU が同じ算出 |
| **Fallback Safety** | GPU fail → CPU fallback で機能継続 |
| **Single Logic Source** | `composeColorFromSteps()` が唯一の実装 |

---

## Summary: Pattern Checklist

新規機能実装時：

- [ ] SolidJS component は local signal + exported `sync*` function
- [ ] Domain state 変更は getter/setter accessor 経由
- [ ] Runtime JSON validation は type guard + asserting guard
- [ ] Layer 間は DI options object 経由（callback/accessor）
- [ ] Event listener は delegation （single parent listener）
- [ ] CPU ↔ GPU 計算は `*-runtime.ts` で shared
- [ ] LUT sampling は texel-center mapping (`u * w - 0.5`)

