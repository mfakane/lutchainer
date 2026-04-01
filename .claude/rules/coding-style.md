# coding-style.md — TypeScript + SolidJS Coding Standards

This guide documents TypeScript code quality and SolidJS JSX constraints for the LUT Chainer project.

## TypeScript Configuration & Type Safety

### Compiler Options (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true,
    "lib": ["ES2020", "DOM"],
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "moduleResolution": "bundler",
    "module": "ESNext",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### Critical Constraints

| Item | Rule | Reason |
|------|------|--------|
| **target: ES2020** | `String.prototype.replaceAll()` forbidden | Only ES2021+ support |
| **strict: true** | All strict flags enabled | implicit any, strict null, strict property init required |
| **jsx: preserve** | SolidJS pre-compilation required | Handled via esbuild plugin |
| **moduleResolution: bundler** | ESM only, CommonJS forbidden | esbuild support |

---

## Variable & Function Naming

### Case Rules

**All `camelCase`** (no exceptions)

```typescript
// ✅ Good
const stepCount = 5;
const isEnabled = true;
function calculateBlendColor(a: Color, b: Color): Color { }
const MAX_TEXTURE_UNITS = 16;  // Constants also camelCase, uppercase

// ❌ Bad
const StepCount = 5;          // PascalCase
const step_count = 5;         // snake_case
const BLEND_MODE = 'multiply'; // Screaming snake
```

### Prefixes / Suffixes

| Prefix | Example | Purpose |
|--------|---------|---------|
| `is`, `has`, `can` | `isEnabled`, `hasSteps`, `canDelete` | Boolean predicates |
| `get`, `set` | `getSteps()`, `setSteps(s)` | Accessors |
| `create` | `createRenderer`, `createPipelineCommandController` | Factory functions |
| `resolve`, `validate` | `resolveDropTarget`, `validateSnapshot` | Helper/utility |
| `on*` | `onPointerDown`, `onStepChange` | Event handlers (callback params) |
| `sync*` | `syncStepListUI(steps)` | SolidJS state syncer exported from component |

---

## Import/Export Patterns

### Module Organization

```typescript
// ✅ Good: Clear import order

// 1. External dependencies
import { createSignal, For } from 'solid-js';

// 2. Domain layer (features/)
import type { StepModel } from '../features/step/types';
import { calculateBlendColor } from '../features/step/step-runtime';

// 3. Rendering layer (shared/rendering/)
import { Renderer } from '../rendering/renderer';

// 4. UI layer (shared/ui, shared/interactions)
import { createDragState } from '../interactions/dnd';
import type { ContainerElement } from '../ui/main-dom-select';

// 5. Internal (same level)
import * as pipelineView from './pipeline-view';
import type { PipelineViewState } from './types';

// ❌ Bad: Circular or reversed layer dependency
import { setupUI } from '../ui/main-setup';  // ❌ Domain importing UI
import { globalState } from './global';      // ❌ Direct mutable state import
```

### Barrel Exports (Recommended Only for `types.ts`)

```typescript
// ✅ features/pipeline/types.ts
export type { BlendMode, StepModel } from '../step/step-model';
export type { PipelineStateSnapshot } from './pipeline-state';
export type { SocketDragState } from './pipeline-view';
export interface PipelineCommandController { ... }

// ❌ Do NOT use barrel exports for logic
// ❌ src/features/step/index.ts (anti-pattern)
export * from './step-model';
export * from './step-runtime';
```

### Type `.d.ts` Files (Prohibited)

```typescript
// ❌ Never create *.d.ts
// - TypeScript only scans .ts files
// - .d.ts are for declaration files (external deps only)
```

---

## SolidJS JSX Rules

### JSX Constraints

| Constraint | Example | Workaround |
|------------|---------|-----------|
| **No comma operator** | `<span>{(lang(), fn())}</span>` | Use helper function |
| **No async/await** | `<button onClick={async () => { await fn() }}/>` | Call async function from handler |
| **Accessor props only** | `<Child count={count} />` | Manage `createSignal` inside component |
| **No createEffect in render** | Side effects during render | Call `sync*` function from parent |

### JSX Patterns

#### Bad: Comma Operator (SolidJS Evaluation Error)

```typescript
const [language] = createSignal('ja');

export function StepLabel(props: { paramName: ParamName }): JSX.Element {
  return (
    // ❌ Error: Comma operator is not allowed in JSX expressions
    <span>{(language(), formatParamName(props.paramName))}</span>
  );
}
```

#### Good: Helper Function (Signal Subscription + Computed Return)

```typescript
const [language, setLanguage] = createSignal('ja');

function formatParamLabel(paramName: ParamName): string {
  language();  // Signal subscription (marks for re-compute)
  return formatParamName(paramName);  // Return computed result
}

export function StepLabel(props: { paramName: ParamName }): JSX.Element {
  return (
    // ✅ OK: Signal subscription + computed return
    <span>{formatParamLabel(props.paramName)}</span>
  );
}
```

#### Bad: Props as Signal

```typescript
interface StepProps {
  steps: () => StepModel[];  // Accessor prop...
}

export function StepList(props: StepProps) {
  // ❌ Bad: Accessing signal-like prop
  return props.steps[0];  // Missing function call `props.steps()`
}
```

#### Good: Accessor Props with Proper Typing

```typescript
import type { Accessor } from 'solid-js';

interface StepProps {
  steps: Accessor<StepModel[]>;  // Explicit
}

export function StepList(props: StepProps) {
  // ✅ OK: Called as function
  return (
    <For each={props.steps()}>
      {(step) => <StepItem step={step} />}
    </For>
  );
}
```

---

## Type Annotations

### When Explicit Type Specification is Critical

#### Callback Parameters

```typescript
// ❌ Bad: Generic type receiver (EventListener) gives TS7006 error
export function bindPointerDown(handler: EventListener) {
  document.addEventListener('pointerdown', handler);
  // handler is generic EventListener → parameter type implicit
}

// Caller side:
bindPointerDown((event) => {
  // ❌ TS7006: Parameter 'event' implicitly has an 'any' type
  const x = event.clientX;
});

// ✅ Good: Use adapter
export function bindPointerDown(handler: (event: PointerEvent) => void) {
  document.addEventListener('pointerdown', (event) => {
    handler(event as PointerEvent);  // Narrow type
  });
}

// Caller side: ✅
bindPointerDown((event) => {
  // event is PointerEvent
  const x = event.clientX;  // ✅ OK
});
```

#### Generic Function Calls

```typescript
// ❌ Bad: Options object callback inferred as unknown
function createController(options: {
  onStatusChange: (msg: unknown) => void;
}) {
  options.onStatusChange(123);  // Actually expects string
}

// ✅ Good: Annotate explicitly
interface CreateControllerOptions {
  onStatusChange: (message: string, kind: StatusKind) => void;
}

function createController(options: CreateControllerOptions) {
  options.onStatusChange('Status OK', 'success');
}
```

### Interface vs Type

```typescript
// ✅ Interfaces for object shapes (extensible)
interface StepModel {
  id: number;
  label: string;
}

// ✅ Type for union/intersection (structural)
type BlendMode = 'multiply' | 'screen' | 'overlay';
type ShaderStage = 'fragment' | 'vertex' | 'hlsl';

// ✅ Type for computed types (complex)
type ApplyLutTexturesResult = 
  | { success: true; textureIds: WebGLTexture[] }
  | { success: false; errors: string[] };
```

---

## File Structure Rules

### File Layout

```typescript
// ✅ Recommended order

// 1. Imports
import { createSignal } from 'solid-js';
import type { StepModel } from './types';
import { calculateBlend } from './step-runtime';

// 2. Type definitions (only if private to this file)
type InternalState = {
  steps: StepModel[];
};

// 3. Constants
const MAX_STEPS = 100;

// 4. Module-level state (if any, minimal)
let globalCache: Map<string, any> = new Map();

// 5. Helper functions (unexported)
function validateInputs(steps: StepModel[]): boolean { }

// 6. Main exported function/component
export function StepList(props: StepListProps): JSX.Element { }

// 7. Other exports
export type { StepListProps };
export function syncStepList(steps: StepModel[]): void { }
```

### Line Length & Indentation

- **Max line**: 100 characters (readability on smaller screens)
- **Indentation**: 2 spaces (SolidJS convention)
- **Trailing comma**: Always include (modern ESM)

```typescript
// ✅ Good
export const MATERIAL_DEFAULTS = {
  baseColor: [1, 1, 1] as const,
  specularStrength: 0.8,
  fresnel: 0.1,
};

// ❌ Bad: line too long (>100 chars)
const result = calculateComplexBlendModeWithManyParameters(colorA, colorB, blendMode, opacity, lightDirection, surfaceNormal);
```

---

## Strings & Formatting

### Template Literals

```typescript
// ✅ OK: Readable
const message = `Step ${stepId}: ${label} (${blendMode})`;

// ✅ OK: Multi-line
const shader = `
  uniform vec3 baseColor;
  void main() {
    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

// ❌ Bad: Concatenation
const message = 'Step ' + stepId + ': ' + label;
```

### URL / Path Handling

```typescript
// ✅ OK: URL constructor or path utility
const dataUrl = `data:image/png;base64,${base64Data}`;

// ✅ OK: Path relative to src/
import { helper } from './shared/utils/helpers';
import { step } from '../features/step/step-model';

// ❌ Bad: Absolute path to src
import { helper } from '/src/shared/utils/helpers';

// ❌ Bad: ../src/ (wrong layering)
import { helper } from '../src/shared/utils/helpers';
```

---

## Comments & Documentation

### JSDoc (Minimal, Complex Functions Only)

```typescript
// ✅ Good: Complex factory with side effects
/**
 * Creates a pipeline command controller with bound state.
 * 
 * @param options - Configuration object with getters/setters
 * @returns Controller with methods: addStep, importSnapshot, etc.
 *
 * @example
 * const ctrl = createPipelineCommandController({
 *   getSteps: () => getPipelineSteps(),
 *   setSteps: (s) => setPipelineSteps(s),
 * });
 */
export function createPipelineCommandController(
  options: PipelineCommandControllerOptions,
): PipelineCommandController { }

// ❌ Bad: Over-documented trivial getter
/**
 * Gets the step count.
 * @returns The number of steps.
 */
function getStepCount(): number { return steps.length; }
```

### Inline Comments (Only When Reason is Non-Obvious)

```typescript
// ✅ Good: Explains *why*, not *what*
export function sampleLutColorLinear(lut: LutModel, u: number, v: number): Color {
  // Texel-center mapping required to match WebGL linear filtering
  // (u * width - 0.5, not u * (width - 1), which causes visible color mismatches)
  const uPixel = u * lut.width - 0.5;
  const vPixel = v * lut.height - 0.5;
  // ... clamp and fetch logic
}

// ❌ Bad: Self-explanatory code doesn't need comments
const color = [r, g, b];  // Create a color
```

---

## Error Messages

```typescript
// ✅ Good: Structured + context
throw new Error(`StepModel validation failed: steps array is empty`);

function assertValidSnapshot(value: unknown, label: string): asserts value is PipelineStateSnapshot {
  if (!isPipelineStateSnapshot(value)) {
    throw new Error(`${label} is invalid: expected PipelineStateSnapshot, got ${typeof value}`);
  }
}

// ❌ Bad: Vague or unclear
throw new Error('Invalid');
throw new Error('Bad input');
```

---

## Final Checklist

Before creating new files/functions:

- [ ] Imports in order: external → domain → rendering → ui
- [ ] File name matches convention (`*-model`, `*-state`, `*-controller`, etc.)
- [ ] No comma operator in SolidJS JSX
- [ ] Callback parameters have explicit type annotation
- [ ] Domain layer doesn't import UI
- [ ] CPU ↔ GPU color consistency
- [ ] Use regex instead of `String.replaceAll()`
- [ ] No `../<src>` import paths
- [ ] Type guard validates runtime data


