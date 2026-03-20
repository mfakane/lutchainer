# coding-style.md — TypeScript + SolidJS コーディング規約

このガイドは、LUT Chainer における TypeScript コード品質と SolidJS JSX の制約について記載します。

## TypeScript 設定 & 型安全性

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

### 重要な制約

| 項目 | ルール | 理由 |
|------|--------|------|
| **target: ES2020** | `String.prototype.replaceAll()` 使用禁止 | ES2021 以上のみ対応 |
| **strict: true** | 全 strict flags 有効 | implicit any、strict null、strict property init 必須 |
| **jsx: preserve** | SolidJS pre-compilation required | esbuild plugin で別途処理 |
| **moduleResolution: bundler** | ESM only、CommonJS 禁止 | esbuild 対応 |

---

## 変数・関数命名

### Case Rules

**全て `camelCase`**（予外なし）

```typescript
// ✅ Good
const stepCount = 5;
const isEnabled = true;
function calculateBlendColor(a: Color, b: Color): Color { }
const MAX_TEXTURE_UNITS = 16;  // 定数も camelCase, uppercase

// ❌ Bad
const StepCount = 5;          // PascalCase
const step_count = 5;         // snake_case
const BLEND_MODE = 'multiply'; // screaming snake
```

### 接頭辞 / 接尾辞

| 接頭辞 | 例 | 用途 |
|--------|-----|------|
| `is`, `has`, `can` | `isEnabled`, `hasSteps`, `canDelete` | boolean predicates |
| `get`, `set` | `getSteps()`, `setSteps(s)` | accessors |
| `create` | `createRenderer`, `createPipelineCommandController` | factory functions |
| `resolve`, `validate` | `resolveDropTarget`, `validateSnapshot` | helper/utility |
| `on*` | `onPointerDown`, `onStepChange` | event handlers (callback params) |
| `sync*` | `syncStepListUI(steps)` | SolidJS state syncer exported from component |

---

## Import/Export パターン

### モジュール構成

```typescript
// ✅ Good: 明確な import 順序

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
import { setupUI } from '../ui/main-setup';  // ❌ Domain が UI をinport
import { globalState } from './global';      // ❌ 直接mutablestateへのimport
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
// - TypeScript は .ts ファイルのみ走査
// - .d.ts は declaration file のみ（external dep）
```

---

## Solid.js JSX Rules

### JSX の制限

| 制限 | 例 | 回避方法 |
|------|-----|--------|
| **No comma operator** | `<span>{(lang(), fn())}</span>` | Helper function を使用 |
| **No async/await** | `<button onClick={async () => { await fn() }}/>` | イベント handler から async function をcall |
| **Accessor props only** | `<Child count={count} />` | `createSignal` を component 内部で管理 |
| **No createEffect in render** | render 中の side effect | Parent から `sync*` function を call |

### JSX 記述パターン

#### Bad: コンマ演算子 (SolidJS で評価エラー)

```typescript
const [language] = createSignal('ja');

export function StepLabel(props: { paramName: ParamName }): JSX.Element {
  return (
    // ❌ Error: Comma operator is not allowed in JSX expressions
    <span>{(language(), formatParamName(props.paramName))}</span>
  );
}
```

#### Good: ヘルパー関数 (signal を購読＋計算結果返却)

```typescript
const [language, setLanguage] = createSignal('ja');

function formatParamLabel(paramName: ParamName): string {
  language();  // signal 購読（変更時に recompute）
  return formatParamName(paramName);  // 計算結果 return
}

export function StepLabel(props: { paramName: ParamName }): JSX.Element {
  return (
    // ✅ OK: Signal subscription + computed return
    <span>{formatParamLabel(props.paramName)}</span>
  );
}
```

#### Bad: Props として Signal を pass

```typescript
interface StepProps {
  steps: () => StepModel[];  // Accessor prop か...
}

export function StepList(props: StepProps) {
  // ❌ Bad: Accessing signal-like prop
  return props.steps[0];  // Missing function call `props.steps()`
}
```

#### Good: Accessor Props with proper typing

```typescript
import type { Accessor } from 'solid-js';

interface StepProps {
  steps: Accessor<StepModel[]>;  // 明示的
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

### 明示的な型指定が必須な場合

#### Callback Parameters

```typescript
// ❌ Bad: EventListener のような generic type receiver でts7006 error
export function bindPointerDown(handler: EventListener) {
  document.addEventListener('pointerdown', handler);
  // handler は Event を受け取る generic EventListener → parameter type が implicit
}

// Caller side:
bindPointerDown((event) => {
  // ❌ TS7006: Parameter 'event' implicitly has an 'any' type
  const x = event.clientX;
});

// ✅ Good: Adapter を使用
export function bindPointerDown(handler: (event: PointerEvent) => void) {
  document.addEventListener('pointerdown', (event) => {
    handler(event as PointerEvent);  // Narrow type
  });
}

// Caller side: ✅
bindPointerDown((event) => {
  // event は PointerEvent に絞られた
  const x = event.clientX;  // ✅ OK
});
```

#### Generic Function Calls

```typescript
// ❌ Bad: Options object の callback が unknown に推論
function createController(options: {
  onStatusChange: (msg: unknown) => void;
}) {
  options.onStatusChange(123);  // 実際には string 期待
}

// ✅ Good: 型を明示
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

### ファイルレイアウト

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

- **Max line**: 100 characters (readability in small screens)
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

## 文字列とフォーマット

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

// ❌ Bad: concat
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

### JSDoc (Minimal, 複雑な関数のみ)

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

### Inline Comments (理由が non-obvious な時のみ)

```typescript
// ✅ Good: Explains *why*, not *what*
export function sampleLutColorLinear(lut: LutModel, u: number, v: number): Color {
  // Texel-center mapping required to match WebGL linear filtering
  // (u * width - 0.5, not u * (width - 1), which causes visible color mismatches)
  const uPixel = u * lut.width - 0.5;
  const vPixel = v * lut.height - 0.5;
  // ... clamp と fetch logic
}

// ❌ Bad: Self-explanatory code doesn't need comments
const color = [r, g, b];  // Create a color
```

---

## Error Messages

```typescript
// ✅ Good: 日本語 + 構造化 + context
throw new Error(`StepModel validation failed: steps array is empty`);

function assertValidSnapshot(value: unknown, label: string): asserts value is PipelineStateSnapshot {
  if (!isPipelineStateSnapshot(value)) {
    throw new Error(`${label} が不正です: expected PipelineStateSnapshot, got ${typeof value}`);
  }
}

// ❌ Bad: Vague or English-only
throw new Error('Invalid');
throw new Error('Bad input');
```

---

## 最後に：チェックリスト

新規ファイル・関数作成時：

- [ ] Imports は external → domain → rendering → ui の順序
- [ ] ファイル名は規約にマッチ (`*-model`, `*-state`, `*-controller` etc.)
- [ ] SolidJS JSX でコンマ演算子 ×
- [ ] Callback parameters に explicit type annotation
- [ ] Domain 層が UI をinport していない
- [ ] CPU ↔ GPU calculations が色を保持
- [ ] `String.replaceAll()` ではなく regex `.replace(/x/g, ...)`
- [ ] `../<src>` import パスなし
- [ ] Type guard で runtime validation

