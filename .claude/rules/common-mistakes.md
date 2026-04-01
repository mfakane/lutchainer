# common-mistakes.md — Common Pitfalls and Fixes

This document describes error patterns frequently encountered during LUT Chainer implementation and provides correction/avoidance strategies.

---

## 1. CPU ↔ GPU Color Mismatch (Texel-Center Mapping Overlooked)

### ❌ Problem

CPU and GPU LUT sampling return different colors.

```typescript
// src/features/step/lut-sampling.ts — ❌ WRONG
export function sampleLutColorLinear(lut: LutModel, u: number, v: number): Color {
  const x = Math.floor(u * lut.width);      // ❌ Wrong
  const y = Math.floor(v * lut.height);
  return readPixel(lut.imageData, x, y);    // ❌ Nearest neighbor only
}
```

**Result**: GPU preview and CPU export show different colors → User frustration

### ✅ Solution

Texel-center mapping + bilinear interpolation:

```typescript
// ✅ CORRECT
export function sampleLutColorLinear(lut: LutModel, u: number, v: number): Color {
  // Texel-center mapping: [0, 1] → [-0.5, width-0.5]
  const uPixel = u * lut.width - 0.5;
  const vPixel = v * lut.height - 0.5;

  const x0 = Math.floor(uPixel);
  const x1 = Math.min(x0 + 1, lut.width - 1);
  const y0 = Math.floor(vPixel);
  const y1 = Math.min(y0 + 1, lut.height - 1);

  // Clamp to image boundaries (CLAMP_TO_EDGE behavior)
  const x0Clamped = Math.max(0, Math.min(x0, lut.width - 1));
  const x1Clamped = Math.max(0, Math.min(x1, lut.width - 1));
  const y0Clamped = Math.max(0, Math.min(y0, lut.height - 1));
  const y1Clamped = Math.max(0, Math.min(y1, lut.height - 1));

  // Bilinear interpolation
  const fx = uPixel - x0;
  const fy = vPixel - y0;

  const c00 = readPixel(lut, x0Clamped, y0Clamped);
  const c10 = readPixel(lut, x1Clamped, y0Clamped);
  const c01 = readPixel(lut, x0Clamped, y1Clamped);
  const c11 = readPixel(lut, x1Clamped, y1Clamped);

  const c0 = blend(c00, c10, fx);
  const c1 = blend(c01, c11, fx);
  return blend(c0, c1, fy);
}
```

---

## 2. Generic Type Inference Pitfall

### ❌ Problem

Callback options infer as `unknown` → TS7006 implicit-any error arises

```typescript
// src/features/pipeline/pipeline-command-controller.ts — ❌ WRONG
export interface PipelineCommandControllerOptions {
  status: (msg: unknown) => void;  // ❌ Too broad
}

// Caller:
const controller = createPipelineCommandController(options);
options.status("Success");  // ✅ Compiles
options.status(123);        // ✅ Also compiles! (but "should fail)
```

### ✅ Solution

Specify types explicitly:

```typescript
// ✅ CORRECT
export interface PipelineCommandControllerOptions {
  status: (msg: string, kind: StatusKind) => void;  // Specific types
}

// Caller:
const controller = createPipelineCommandController(options);
options.status("Success", "info");  // ✅ OK
options.status(123, "error");       // ❌ TS error (expected string)
```

### Pattern: EventListener Adapter

```typescript
// ❌ WRONG: EventListener generic type
document.addEventListener('pointerdown', (event) => {
  // ❌ TS7006: Parameter 'event' implicitly has an 'any' type
  const x = event.clientX;
});

// ✅ CORRECT: Explicit type annotation
document.addEventListener('pointerdown', (event: PointerEvent) => {
  const x = event.clientX;  // ✅ OK
});

// Or create typed adapter:
export function onPointerDown(handler: (event: PointerEvent) => void) {
  document.addEventListener('pointerdown', (event) => {
    handler(event as PointerEvent);
  });
}

onPointerDown((event) => {
  // event is PointerEvent ✓
  const x = event.clientX;
});
```

---

## 3. Circular Dependency (Direct State Import)

### ❌ Problem

Domain imports UI callback directly → Circular dependency

```typescript
// src/features/pipeline/pipeline-state.ts — ❌ WRONG
import { notifyUI } from '../../shared/ui/main-setup';  // ❌ Circular!

export function setPipelineSteps(steps: StepModel[]): void {
  _pipelineSnapshot.steps = steps;
  notifyUI();  // UI knows about state change
}

// src/shared/ui/main-setup.ts
import { getPipelineSteps } from '../../features/pipeline/pipeline-state';  // ❌ Circular!

export function notifyUI() {
  const steps = getPipelineSteps();
  syncUI(steps);
}
```

**Error**: Module resolution cycle detected

### ✅ Solution

Dependency Injection: inject callback via options

```typescript
// src/features/pipeline/pipeline-state.ts — ✅ CORRECT
let _onStepsChange: ((steps: StepModel[]) => void) | null = null;

export function setOnStepsChangeCallback(callback: (steps: StepModel[]) => void) {
  _onStepsChange = callback;
}

export function setPipelineSteps(steps: StepModel[]): void {
  _pipelineSnapshot.steps = steps;
  if (_onStepsChange) {
    _onStepsChange(steps);
  }
}

// src/shared/ui/main-setup.ts
import { setOnStepsChangeCallback, getPipelineSteps } from '../../features/pipeline/pipeline-state';

setOnStepsChangeCallback((steps) => {
  syncUI(steps);  // Callback provided, no circular import
});
```

**Better**: Options object pattern

---

## 4. SolidJS Root Mounting Issues

### ❌ Problem A: Mount Multiple Times

```typescript
// ❌ WRONG: Mounting component twice
render(() => <StepList />, container);
render(() => <StepList />, container);  // Second mount = error or memory leak
```

### ❌ Problem B: Signal Loading Forgotten (Reactive Tracking)

```typescript
// SolidJS pattern: Signal subscription is mandatory
const [language, setLanguage] = createSignal('ja');

function setParamLabel(param: ParamName): string {
  // ❌ WRONG: No signal loading
  const label = `${param} (${getLocalizedParamName(param)})`;  // Stale cache
  return label;
}

// ✅ CORRECT: Signal loading + helper computation
function getParamLabel(param: ParamName): string {
  language();  // 📡 Signal subscription (marked for re-computation)
  return `${param} (${getLocalizedParamName(param)})`;
}
```

### ✅ Solution: Mount Once + Sync Export

```typescript
// src/shared/components/solid-pipeline-lists.tsx — ✅ CORRECT
let syncInternal: ((steps: StepModel[]) => void) | null = null;

export function mountStepList(options: StepListMountOptions): void {
  const container = document.getElementById('step-list-container');
  if (!container) return;

  // ✅ Mount once
  render(
    () => <StepList {...options} />,
    container,
  );

  // Capture sync function (exported from component)
  window.syncStepList = (steps: StepModel[]) => {
    if (syncInternal) syncInternal(steps);
  };
}

function StepList(props: StepListProps): JSX.Element {
  const [steps, setSteps] = createSignal(props.initialSteps);
  const [language] = createSignal('ja');

  // Export sync function for parent orchestrator
  syncInternal = (newSteps: StepModel[]) => setSteps(newSteps);

  return (
    <div>
      <For each={steps()}>
        {(step) => {
          // ✅ Read signal inside component (auto-tracked)
          const label = getStepLabel(step);
          return <StepItem step={step} label={label} />;
        }}
      </For>
    </div>
  );
}
```

---

## 5. TypeScript Import Path Errors

### ❌ Problem A: `/src/` Absolute Path

```typescript
// ❌ WRONG: Absolute path to src/
import { helper } from '/src/shared/utils/helpers';
// Module not found: /src/ doesn't exist in build context
```

### ❌ Problem B: `../src/` Path (Wrong Restructuring)

```typescript
// src/features/step/step-model.ts — ❌ WRONG
import { helper } from '../src/shared/utils/helpers';
// Should be: ../../shared/utils/helpers
```

### ✅ Solution: Relative Path from File Location

```typescript
// src/features/step/step-model.ts — ✅ CORRECT
import { helper } from '../../shared/utils/helpers';

// src/shared/components/solid-pipeline-lists.tsx — ✅ CORRECT
import { StepModel } from '../../features/pipeline/types';

// src/shared/ui/main-setup.ts — ✅ CORRECT
import { pipelineController } from '../../features/pipeline/pipeline-command-controller';
import { Renderer } from '../rendering/renderer';
```

### Rule: Folder Structure Navigation

```
src/
├─ features/
│  ├─ pipeline/
│  │  └─ pipeline-state.ts (here)
│  │     import { X } from '../step/step-model'  ✅ (sibling feature)
│  │     import { X } from '../../shared/ui/...' ✅ (up 2 levels)
│  └─ step/
├─ shared/
│  ├─ components/
│  │  └─ solid-pipeline-lists.tsx (here)
│  │     import { X } from '../ui/...'           ✅ (sibling folder)
│  │     import { X } from '../../features/...'  ✅ (up 2 levels)
│  └─ ui/
```

---

## 6. SolidJS JSX Comma Operator (Forbidden in JSX)

### ❌ Problem

```typescript
// ❌ INVALID: Comma operator not allowed in JSX
<span>{(language(), formatLabel(param))}</span>
// SyntaxError: Property assignment expected
```

### ✅ Solution: Helper Function

```typescript
// ✅ CORRECT: Helper that reads signal and returns value
const [language] = createSignal('ja');

function formatParamLabel(param: ParamName): string {
  language();  // Signal subscription
  return `${param}: ${getLocalizedName(param)}`;
}

// In JSX:
<span>{formatParamLabel(param)}</span>
```

### Workaround: createMemo for Expensive Computation

```typescript
// If computation is expensive, use createMemo
const paramLabel = createMemo(() => {
  language();  // Re-run when language changes
  return `${param}: ${getLocalizedName(param)}`;
});

<span>{paramLabel()}</span>
```

---

## 7. Domain State Direct Mutation (Bypassing Setter)

### ❌ Problem

```typescript
// ❌ WRONG: Direct mutation
import { globalPipelineState } from './pipeline-state';

globalPipelineState.steps.push(newStep);
globalPipelineState.steps[0].label = 'Changed';

// ❌ Other code won't know about state change
// ❌ No validation
// ❌ No undo/redo tracking
```

### ✅ Solution: Setter Only

```typescript
// ✅ CORRECT: Use setter
import { getPipelineSteps, setPipelineSteps } from './pipeline-state';

const steps = getPipelineSteps();
const newSteps = [...steps, newStep];  // Immutable update
setPipelineSteps(newSteps);            // Validation + callback

// Or via controller:
controller.addStep(afterIdx);
```

---

## 8. WebGL Texture Binding Order

### ❌ Problem

```typescript
// ❌ WRONG: activeTexture call order is wrong
for (let i = 0; i < luts.length; i++) {
  const unit = gl.TEXTURE0 + i;
  
  gl.bindTexture(gl.TEXTURE_2D, texture);   // ❌ activeTexture first!
  gl.activeTexture(unit);
  
  const uniformLoc = gl.getUniformLocation(program, `lutSampler${i}`);
  gl.uniform1i(uniformLoc, i);
}
```

Result: Texture bindings are misaligned → wrong LUT applied to shader

### ✅ Solution: Correct Order

```typescript
// ✅ CORRECT
for (let i = 0; i < luts.length; i++) {
  const unit = gl.TEXTURE0 + i;
  
  gl.activeTexture(unit);              // ✅ Select unit FIRST
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(...);                  // Upload pixel data
  gl.texParameteri(..., gl.LINEAR);    // Linear filtering
  
  const uniformLoc = gl.getUniformLocation(program, `lutSampler${i}`);
  gl.uniform1i(uniformLoc, i);         // Bind unit to sampler
}
```

---

## 9. DOM Selector Brittleness with Special Characters

### ❌ Problem

```typescript
// ❌ WRONG: data-* selector with dynamic ID
const lutId = 'lut_1:special-chars';  // Contains special chars
const element = document.querySelector(`[data-lut-id="${lutId}"]`);
// CSS selector syntax error if ID has quotes or brackets
```

### ✅ Solution: Direct Attribute Comparison

```typescript
// ✅ CORRECT: Compare dataset safely
const lutId = 'lut_1:special-chars';
const elements = document.querySelectorAll('[data-lut-id]');
const element = Array.from(elements).find((el) => 
  el.getAttribute('data-lut-id') === lutId
);
```

---

## 10. EventListener Type Casting Issues

### ❌ Problem

```typescript
// ❌ WRONG: EventListener rejects strict event type
function myHandler(event: KeyboardEvent): void {
  console.log(event.key);
}

document.addEventListener('keydown', myHandler);
// TS Error: Argument of type '(event: KeyboardEvent) => void' 
//           is not assignable to parameter of type 'EventListener'
```

### ✅ Solution: Event Type Cast in Handler

```typescript
// ✅ CORRECT: Cast inside listener
function myHandler(event: KeyboardEvent): void {
  console.log(event.key);
}

document.addEventListener('keydown', (event) => {
  myHandler(event as KeyboardEvent);
});

// Or create adapter:
function onKeyDown(handler: (event: KeyboardEvent) => void): void {
  document.addEventListener('keydown', (event) => {
    if (event instanceof KeyboardEvent) {
      handler(event);
    }
  });
}

onKeyDown((event) => {
  console.log(event.key);  // Type-safe
});
```

---

## 11. State Snapshot Serialization

### ❌ Problem

```typescript
// ❌ WRONG: Assuming all data can serialize
import type { PipelineStateSnapshot } from './types';

const snapshot = JSON.parse(jsonString) as PipelineStateSnapshot;
// ❌ No validation! Bad data passes through
```

### ✅ Solution: Guard + Assert

```typescript
// ✅ CORRECT: Validate before use
import { assertPipelineStateSnapshot } from './pipeline-state';

const snapshot = JSON.parse(jsonString);
assertPipelineStateSnapshot(snapshot);  // Throws if bad data
// Now snapshot is safely typed
```

---

## 12. TypeScript Strict Mode: Null/Undefined Checking

### ❌ Problem

```typescript
// ❌ WRONG: Assumes nullable is defined
const steps: StepModel[] | null = getPipelineSteps();
steps.forEach(step => console.log(step.id));  // ❌ TS error (nullish)
```

### ✅ Solution: Guard Clause

```typescript
// ✅ CORRECT: Guard before access
const steps: StepModel[] | null = getPipelineSteps();
if (!steps) return;                           // Guard
steps.forEach(step => console.log(step.id));  // ✅ steps is StepModel[]
```

---

## Quick Checklist: Before Submitting Code

- [ ] Relative import paths use `./` or `../`, not `/src/`
- [ ] No direct mutable state import (use getter/setter)
- [ ] SolidJS signals are read inside component (not in JSX comma operator)
- [ ] CPU LUT sampling uses texel-center mapping (`u * w - 0.5`)
- [ ] Runtime JSON validated with `assertMaybe(value)`
- [ ] WebGL texture binding: `activeTexture` → `bindTexture` → `texImage2D`
- [ ] Generic callback options have explicit types (not `unknown`)
- [ ] No circular imports between layers
- [ ] DOM selectors use `.dataset` comparison (not CSS selector) for dynamic IDs
- [ ] EventListener type edge cases cast inside handler


### ❌ Problem

CPU と GPU の LUT sampling が異なる色を返す。

```typescript
// src/features/step/lut-sampling.ts — ❌ WRONG
export function sampleLutColorLinear(lut: LutModel, u: number, v: number): Color {
  const x = Math.floor(u * lut.width);      // ❌ Wrong
  const y = Math.floor(v * lut.height);
  return readPixel(lut.imageData, x, y);    // ❌ Nearest neighbor only
}
```

**Result**: GPU preview と CPU export で色が違う → User confusion

### ✅ Solution

Texel-center mapping + bilinear interpolation:

```typescript
// ✅ CORRECT
export function sampleLutColorLinear(lut: LutModel, u: number, v: number): Color {
  // Texel-center mapping: [0, 1] → [-0.5, width-0.5]
  const uPixel = u * lut.width - 0.5;
  const vPixel = v * lut.height - 0.5;

  const x0 = Math.floor(uPixel);
  const x1 = Math.min(x0 + 1, lut.width - 1);
  const y0 = Math.floor(vPixel);
  const y1 = Math.min(y0 + 1, lut.height - 1);

  // Clamp to image boundaries (CLAMP_TO_EDGE behavior)
  const x0Clamped = Math.max(0, Math.min(x0, lut.width - 1));
  const x1Clamped = Math.max(0, Math.min(x1, lut.width - 1));
  const y0Clamped = Math.max(0, Math.min(y0, lut.height - 1));
  const y1Clamped = Math.max(0, Math.min(y1, lut.height - 1));

  // Bilinear interpolation
  const fx = uPixel - x0;
  const fy = vPixel - y0;

  const c00 = readPixel(lut, x0Clamped, y0Clamped);
  const c10 = readPixel(lut, x1Clamped, y0Clamped);
  const c01 = readPixel(lut, x0Clamped, y1Clamped);
  const c11 = readPixel(lut, x1Clamped, y1Clamped);

  const c0 = blend(c00, c10, fx);
  const c1 = blend(c01, c11, fx);
  return blend(c0, c1, fy);
}
```

### References

- [lut-sampling.ts L10-40](../../src/features/step/lut-sampling.ts#L10-L40)
- [User Memory: CPU image sampling](../../CLAUDE.md#cpu-↔-gpu-rendering-fallback)

---

## 2. Generic Type Inference の落とし穴

### ❌ Problem

Callback options が `unknown` に推論される → TS7006 implicit-any error が発生

```typescript
// src/features/pipeline/pipeline-command-controller.ts — ❌ WRONG
export interface PipelineCommandControllerOptions {
  status: (msg: unknown) => void;  // ❌ Too broad
}

// Caller:
const controller = createPipelineCommandController(options);
options.status("Success");  // ✅ Compiles
options.status(123);        // ✅ Also compiles! (but should fail)
```

### ✅ Solution

明示的に型を指定：

```typescript
// ✅ CORRECT
export interface PipelineCommandControllerOptions {
  status: (msg: string, kind: StatusKind) => void;  // Specific types
}

// Caller:
const controller = createPipelineCommandController(options);
options.status("Success", "info");  // ✅ OK
options.status(123, "error");       // ❌ TS error (expected string)
```

### Pattern: EventListener Adapter

```typescript
// ❌ WRONG: EventListener generic type
document.addEventListener('pointerdown', (event) => {
  // ❌ TS7006: Parameter 'event' implicitly has an 'any' type
  const x = event.clientX;
});

// ✅ CORRECT: Explicit type annotation
document.addEventListener('pointerdown', (event: PointerEvent) => {
  const x = event.clientX;  // ✅ OK
});

// Or create typed adapter:
export function onPointerDown(handler: (event: PointerEvent) => void) {
  document.addEventListener('pointerdown', (event) => {
    handler(event as PointerEvent);
  });
}

onPointerDown((event) => {
  // event is PointerEvent ✓
  const x = event.clientX;
});
```

---

## 3. Circular Dependency (Direct State Import)

### ❌ Problem

Domain → UI callback を直接 import → Circular dependency

```typescript
// src/features/pipeline/pipeline-state.ts — ❌ WRONG
import { notifyUI } from '../../shared/ui/main-setup';  // ❌ Circular!

export function setPipelineSteps(steps: StepModel[]): void {
  _pipelineSnapshot.steps = steps;
  notifyUI();  // UI knows about state change
}

// src/shared/ui/main-setup.ts
import { getPipelineSteps } from '../../features/pipeline/pipeline-state';  // ❌ Circular!

export function notifyUI() {
  const steps = getPipelineSteps();
  syncUI(steps);
}
```

**Error**: Module resolution cycle detected

### ✅ Solution

Dependency Injection: callback を options 经由で inject

```typescript
// src/features/pipeline/pipeline-state.ts — ✅ CORRECT
let _onStepsChange: ((steps: StepModel[]) => void) | null = null;

export function setOnStepsChangeCallback(callback: (steps: StepModel[]) => void) {
  _onStepsChange = callback;
}

export function setPipelineSteps(steps: StepModel[]): void {
  _pipelineSnapshot.steps = steps;
  if (_onStepsChange) {
    _onStepsChange(steps);
  }
}

// src/shared/ui/main-setup.ts
import { setOnStepsChangeCallback, getPipelineSteps } from '../../features/pipeline/pipeline-state';

setOnStepsChangeCallback((steps) => {
  syncUI(steps);  // Callback provided, no circular import
});
```

**Better**: Options object pattern (see [architecture.md](architecture.md#dependency-injection-pattern))

---

## 4. SolidJS Root Mounting Issues

### ❌ Problem A: Mount Multiple Times

```typescript
// ❌ WRONG: Mounting component twice
render(() => <StepList />, container);
render(() => <StepList />, container);  // Second mount = error or memory leak
```

### ❌ Problem B: Signal読み込み忘れ (Reactive Tracking)

```typescript
// SolidJS パターン: Signal購読が必須
const [language, setLanguage] = createSignal('ja');

function setParamLabel(param: ParamName): string {
  // ❌ WRONG: Signal 読み込みなし
  const label = `${param} (${getLocalizedParamName(param)})`;  // Stale cache
  return label;
}

// ✅ CORRECT: Signal 読み込み＋ helper で computation
function getParamLabel(param: ParamName): string {
  language();  // 📡 Signal subscription (marked for re-computation)
  return `${param} (${getLocalizedParamName(param)})`;
}
```

### ✅ Solution: Mount Once + Sync Export

```typescript
// src/shared/components/solid-pipeline-lists.tsx — ✅ CORRECT
let syncInternal: ((steps: StepModel[]) => void) | null = null;

export function mountStepList(options: StepListMountOptions): void {
  const container = document.getElementById('step-list-container');
  if (!container) return;

  // ✅ Mount once
  render(
    () => <StepList {...options} />,
    container,
  );

  // Capture sync function (exported from component)
  window.syncStepList = (steps: StepModel[]) => {
    if (syncInternal) syncInternal(steps);
  };
}

function StepList(props: StepListProps): JSX.Element {
  const [steps, setSteps] = createSignal(props.initialSteps);
  const [language] = createSignal('ja');

  // Export sync function for parent orchestrator
  syncInternal = (newSteps: StepModel[]) => setSteps(newSteps);

  return (
    <div>
      <For each={steps()}>
        {(step) => {
          // ✅ Read signal inside component (auto-tracked)
          const label = getStepLabel(step);
          return <StepItem step={step} label={label} />;
        }}
      </For>
    </div>
  );
}
```

---

## 5. TypeScript Import Path Errors

### ❌ Problem A: `/src/` Absolute Path

```typescript
// ❌ WRONG: Absolute path to src/
import { helper } from '/src/shared/utils/helpers';
// Module not found: build context では /src/ 実在しない
```

### ❌ Problem B: `../src/` Path (Wrong Rethinking)

```typescript
// src/features/step/step-model.ts — ❌ WRONG
import { helper } from '../src/shared/utils/helpers';
// Should be: ../../shared/utils/helpers
```

### ✅ Solution: Relative Path from File Location

```typescript
// src/features/step/step-model.ts — ✅ CORRECT
import { helper } from '../../shared/utils/helpers';

// src/shared/components/solid-pipeline-lists.tsx — ✅ CORRECT
import { StepModel } from '../../features/pipeline/types';

// src/shared/ui/main-setup.ts — ✅ CORRECT
import { pipelineController } from '../../features/pipeline/pipeline-command-controller';
import { Renderer } from '../rendering/renderer';
```

### Rule: Folder Structure Navigation

```
src/
├─ features/
│  ├─ pipeline/
│  │  └─ pipeline-state.ts (here)
│  │     import { X } from '../step/step-model'  ✅ (sibling feature)
│  │     import { X } from '../../shared/ui/...' ✅ (up 2 levels)
│  └─ step/
├─ shared/
│  ├─ components/
│  │  └─ solid-pipeline-lists.tsx (here)
│  │     import { X } from '../ui/...'           ✅ (sibling folder)
│  │     import { X } from '../../features/...'  ✅ (up 2 levels)
│  └─ ui/
```

---

## 6. SolidJS JSX コンマ演算子 (Forbidden in JSX)

### ❌ Problem

```typescript
// ❌ INVALID: Comma operator not allowed in JSX
<span>{(language(), formatLabel(param))}</span>
// SyntaxError: Property assignment expected
```

### ✅ Solution: Helper Function

```typescript
// ✅ CORRECT: Helper that reads signal and returns value
const [language] = createSignal('ja');

function formatParamLabel(param: ParamName): string {
  language();  // Signal subscription
  return `${param}: ${getLocalizedName(param)}`;
}

// In JSX:
<span>{formatParamLabel(param)}</span>
```

### Workaround: createMemo for Expensive Computation

```typescript
// If computation is expensive, use createMemo
const paramLabel = createMemo(() => {
  language();  // Re-run when language changes
  return `${param}: ${getLocalizedName(param)}`;
});

<span>{paramLabel()}</span>
```

---

## 7. Domain State 直接変更 (Bypassing Setter)

### ❌ Problem

```typescript
// ❌ WRONG: Direct mutation
import { globalPipelineState } from './pipeline-state';

globalPipelineState.steps.push(newStep);
globalPipelineState.steps[0].label = 'Changed';

// ❌ Other code won't know about state change
// ❌ No validation
// ❌ No undo/redo tracking
```

### ✅ Solution: Setter Only

```typescript
// ✅ CORRECT: Use setter
import { getPipelineSteps, setPipelineSteps } from './pipeline-state';

const steps = getPipelineSteps();
const newSteps = [...steps, newStep];  // Immutable update
setPipelineSteps(newSteps);            // Validation + callback

// Or via controller:
controller.addStep(afterIdx);
```

---

## 8. WebGL Texture Binding Order

### ❌ Problem

```typescript
// ❌ WRONG: activeTexture call order is wrong
for (let i = 0; i < luts.length; i++) {
  const unit = gl.TEXTURE0 + i;
  
  gl.bindTexture(gl.TEXTURE_2D, texture);   // ❌ activeTexture first!
  gl.activeTexture(unit);
  
  const uniformLoc = gl.getUniformLocation(program, `lutSampler${i}`);
  gl.uniform1i(uniformLoc, i);
}
```

Result: Texture bindings are misaligned → wrong LUT applied to shader

### ✅ Solution: Correct Order

```typescript
// ✅ CORRECT
for (let i = 0; i < luts.length; i++) {
  const unit = gl.TEXTURE0 + i;
  
  gl.activeTexture(unit);              // ✅ Select unit FIRST
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(...);                  // Upload pixel data
  gl.texParameteri(..., gl.LINEAR);    // Linear filtering
  
  const uniformLoc = gl.getUniformLocation(program, `lutSampler${i}`);
  gl.uniform1i(uniformLoc, i);         // Bind unit to sampler
}
```

Reference: [lut-texture-utils.ts](../../src/shared/rendering/lut-texture-utils.ts)

---

## 9. DOM Selector Brittleness with Special Characters

### ❌ Problem

```typescript
// ❌ WRONG: data-* selector with dynamic ID
const lutId = 'lut_1:special-chars';  // Contains special chars
const element = document.querySelector(`[data-lut-id="${lutId}"]`);
// CSS selector syntax error if ID has quotes or brackets
```

### ✅ Solution: Direct Attribute Comparison

```typescript
// ✅ CORRECT: Compare dataset safely
const lutId = 'lut_1:special-chars';
const elements = document.querySelectorAll('[data-lut-id]');
const element = Array.from(elements).find((el) => 
  el.getAttribute('data-lut-id') === lutId
);
```

Reference: [CLAUDE.md: Anti-Pattern #2](../CLAUDE.md#2-dom-selector-brittleness)

---

## 10. EventListener Type Casting Issues

### ❌ Problem

```typescript
// ❌ WRONG: EventListener rejects strict event type
function myHandler(event: KeyboardEvent): void {
  console.log(event.key);
}

document.addEventListener('keydown', myHandler);
// TS Error: Argument of type '(event: KeyboardEvent) => void' 
//           is not assignable to parameter of type 'EventListener'
```

### ✅ Solution: Event Type Cast in Handler

```typescript
// ✅ CORRECT: Cast inside listener
function myHandler(event: KeyboardEvent): void {
  console.log(event.key);
}

document.addEventListener('keydown', (event) => {
  myHandler(event as KeyboardEvent);
});

// Or create adapter:
function onKeyDown(handler: (event: KeyboardEvent) => void): void {
  document.addEventListener('keydown', (event) => {
    if (event instanceof KeyboardEvent) {
      handler(event);
    }
  });
}

onKeyDown((event) => {
  console.log(event.key);  // Type-safe
});
```

---

## 11. State Snapshot Serialization

### ❌ Problem

```typescript
// ❌ WRONG: Assuming all data can serialize
import type { PipelineStateSnapshot } from './types';

const snapshot = JSON.parse(jsonString) as PipelineStateSnapshot;
// ❌ No validation! Bad data passes through
```

### ✅ Solution: Guard + Assert

```typescript
// ✅ CORRECT: Validate before use
import { assertPipelineStateSnapshot } from './pipeline-state';

const snapshot = JSON.parse(jsonString);
assertPipelineStateSnapshot(snapshot);  // Throws if bad data
// Now snapshot is safely typed
```

---

## 12. TS Strict Mode: Null/Undefined Checking

### ❌ Problem

```typescript
// ❌ WRONG: Assumes nullable is defined
const steps: StepModel[] | null = getPipelineSteps();
steps.forEach(step => console.log(step.id));  // ❌ TS error (nullish)
```

### ✅ Solution: Guard Clause

```typescript
// ✅ CORRECT: Guard before access
const steps: StepModel[] | null = getPipelineSteps();
if (!steps) return;                           // Guard
steps.forEach(step => console.log(step.id));  // ✅ steps is StepModel[]
```

---

## Quick Checklist: Before Submitting Code

- [ ] Relative import paths use `./` or `../`, not `/src/`
- [ ] No direct mutable state import (use getter/setter)
- [ ] SolidJS signals are read inside component (not in JSX comma operator)
- [ ] CPU LUT sampling uses texel-center mapping (`u * w - 0.5`)
- [ ] Runtime JSON validated with `assertMaybe(value)`
- [ ] WebGL texture binding: `activeTexture` → `bindTexture` → `texImage2D`
- [ ] Generic callback options have explicit types (not `unknown`)
- [ ] No circular imports between layers
- [ ] DOM selectors use `.dataset` comparison (not CSS selector) for dynamic IDs
- [ ] EventListener type edge cases cast inside handler

