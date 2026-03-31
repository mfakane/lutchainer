# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# LUT Chainer AI Agent ガイド

本ドキュメントは、LUT Chainer プロジェクトに対して AI Agent（GitHub Copilot、カスタムエージェント等）が的確に支援できるよう設計ガイドを記載しています。

## 📋 プロジェクト概要

**LUT Chainer** は、ブラウザで動作する LUT ベースのステップチェーン型シェーダエディタです。

### 主な機能

- **LUT Step Chain 編集** — 複数の LUT と Blend Mode を段階的に組み合わせ
- **リアルタイム 3D プレビュー** — WebGL + CPU fallback で見た目を調整
- **Material / Light パラメータ調整** — 光源・マテリアル設定
- **生成コード表示** — GLSL / HLSL の自動生成と表示
- **パイプライン保存・読み込み** — JSON + Base64 LUT 埋め込み

### 技術スタック

| レイヤー | 技術 | 用途 |
|---------|------|------|
| **言語** | TypeScript (ES2020, strict) | 型安全な開発 |
| **UI Framework** | SolidJS | リアクティブコンポーネント |
| **ビルド** | esbuild + TypeScript | 高速ビルド |
| **グラフィックス** | WebGL 1.0 + CPU fallback | 3D レンダリング |
| **圧縮** | fflate | ZIP エクスポート |
| **国際化** | カスタム i18n system | ja/en 対応 |

---

## 🏗️ アーキテクチャ：3層構造

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

### 層の責務

| 層 | 役割 | 主要ファイル |
|----|------|----------|
| **Domain (features/)** | Pure data + logic; IO serialization | `*-model.ts`, `*-state.ts`, `*-runtime.ts` |
| **Rendering (shared/rendering/)** | WebGL context + shader generation + CPU fallback | `renderer.ts`, `shader-generator.ts`, `lut-texture-utils.ts` |
| **UI (shared/ui, shared/components)** | DOM coordination + event handling + SolidJS mounts | `main-*.ts`, `solid-*.tsx`, `*-controller.ts` |

**重要**: 層間の依存関係は 上→下 のみ。Domain 層は他に依存しない。

---

## 📛 ファイル名規約と役割

AI Agent が新規ファイルを作成する際の命名規約（厳守）：

| パターン | 例 | 役割 |
|---------|-----|------|
| `*-model.ts` | `pipeline-model.ts`, `step-model.ts` | **Data structures, enums, constants** — 不変のスキーマ定義 |
| `*-state.ts` | `pipeline-state.ts`, `interaction-state.ts` | **Mutable state with accessors** — getter/setter + validation |
| `*-runtime.ts` | `step-runtime.ts` | **Pure computation logic** — stateless algorithms |
| `*-controller.ts` | `pipeline-command-controller.ts`, `gizmo-overlay-controller.ts` | **Stateful event handlers** — `create*` factory returns controller object |
| `*-bindings.ts` | `pipeline-dnd-bindings.ts` | **Event wiring + DnD setup** — pure configuration, no state |
| `*-view.ts` | `pipeline-view.ts` | **UI state + helpers** — drop indicators, drag state |
| `*-system.ts` | `step-preview-system.ts`, `render-system.ts` | **Lifecycle manager** — init, update, cleanup |
| `solid-*.tsx` | `solid-pipeline-lists.tsx`, `solid-shader-dialog.tsx` | **SolidJS components** — export `mount*` function |
| `main-*.ts` | `main-pipeline-editor-setup.ts`, `main-orbit-state.ts` | **UI orchestrators** — called from `main.ts`, coordinate setup |
| `types.ts` | `features/pipeline/types.ts`, `features/step/types.ts` | **Barrel exports** — re-export types from `*-model.ts`, `*-state.ts` |

---

## ⚡ Core Rules (AI Agent 必読)

### Rule 1: 層の違反禁止 🚫

❌ **Bad**: Domain 層が `shared/rendering/` or `shared/ui/` をインポート  
❌ **Bad**: Rendering 層が `solid-*.tsx` をインポート

✅ **Good**:
```typescript
// Domain: Pure logic only
export function composeColorFromSteps(steps: readonly StepRuntimeModel[]): Color { ... }

// UI imports Domain:
import { composeColorFromSteps } from '../features/step/step-runtime';
```

### Rule 2: 状態アクセスは Getter/Setter 経由 🔒

❌ **Bad**:
```typescript
// Direct mutable import
import { globalPipelineState } from './pipeline-state';
globalPipelineState.steps = newSteps;  // ❌ 直接変更

// Domain が UI callback を知っている
import { updateUI } from '../ui/main-setup';
updateUI();  // ❌ circular dependency 危険
```

✅ **Good** — Dependency Injection via Options:
```typescript
const controller = createPipelineCommandController({
  getSteps: () => getPipelineSteps(),
  setSteps: (s) => setPipelineSteps(s),
  status: (msg, kind) => statusDisplay.show(msg, kind),
  t: (key) => translate(key),
});
// UI calls controller.addStep(), stepの削除 etc.
```

### Rule 3: SolidJS JSX の制限を認識 ⚠️

❌ **Bad** — コンマ演算子は JSX で使えない:
```typescript
<span>{(language(), formatParam(param))}</span>  // ❌ SolidJS error
```

✅ **Good** — ヘルパー関数を使用:
```typescript
function tr(param: ParamName): string {
  _language();  // signal 購読
  return formatParam(param);
}
<span>{tr(param)}</span>  // ✅
```

### Rule 4: TypeScript Strict Mode + 型推論 🎯

**Strict Flags** (`tsconfig.json`):
- `strict: true` — 全て有効
- `jax: preserve` + `jsxImportSource: "solid-js"` — SolidJS mode
- `target: ES2020` — `String.replaceAll()` × (use regex instead)

❌ **Bad** — Generic 型推論が広がる:
```typescript
const controller = createController(options);  // unknown[]:  TS7006 implicit-any
```

✅ **Good** — 明示的な型引数:
```typescript
const controller = createController<PipelineCommandControllerOptions>(options);
```

### Rule 5: CPU ↔ GPU Rendering の一貫性 🎨

**LUT Sampling**: CPU fallback と WebGL が同じ色を出す必要があります。

✅ **Texel-center mapping** (両方で統一):
```typescript
// CPU: lut-sampling.ts
const u_pixel = u * width - 0.5;   // ✅ texel center
const v_pixel = v * height - 0.5;

// WebGL: linear filtering (hardware 対応で自動)
```

❌ **Bad** — `u * (width - 1)` は色ズレ起こす

---

## 🚫 AI Agent が避けるべき反パターン（5項目）

### 1. 相対パスの誤り（`../src` は使用禁止）

**Context**: Folder 再構成後、`src/` は import base になった  
**Bad**: `import { helper } from '../shared/utils'`  
**Good**: `import { helper } from './shared/utils'` (same level) or `import { helper } from '../features/step/...'`

**Rule**: module はつねに `src/features`, `src/shared` 以下にあると仮定して、相対パスを `.` or `..` から開始する。

---

### 2. DOM Selector Brittleness（data-* attribute での selector mutation）

**Context**: `data-lut-id`, `data-step-id` 等の dynamic ID 使用時、特殊文字で selector breakable

**Bad**:
```typescript
const element = document.querySelector(`[data-lut-id="${lutId}"]`);
// lutId に quotes 含有 → selector break
```

**Good** — 直接比較:
```typescript
const elements = document.querySelectorAll('[data-lut-id]');
Array.from(elements).find(el => el.dataset.lutId === lutId);
```

---

### 3. Generic Call with Overly Broad Union Type

**Context**: Options object の callback 型推論

**Bad**:
```typescript
function createController(options: { onStatusChange: (msg: unknown) => void }) {
  options.onStatusChange(123);  // ✅ compiles, but (msg: string) 期待
}
```

**Good** — 明示的に annotate:
```typescript
interface Options {
  onStatusChange: (msg: string, kind: StatusKind) => void;
}
```

---

### 4. No createEffect in Render Path (Solid.js anti-pattern)

**Context**: SolidJS は signal-driven；createEffect は side effect only

**Bad**:
```typescript
const [steps, setSteps] = createSignal(initialSteps);
createEffect(() => {
  // Render every time steps change → performance issue
  renderPreview();
});
```

**Good** — Parent orchestrator が呼び出す:
```typescript
// UI層 (main.ts):
const steps = getPipelineSteps();
syncStepListUI(steps);  // exported from solid-pipeline-lists.tsx

// solid-pipeline-lists.tsx:
export function syncStepListUI(newSteps: StepModel[]): void {
  setSteps(newSteps);  // signal update → auto re-render
}
```

---

### 5. Asserting Guard Type Predicate Usage

**Context**: Runtime data validation； TS type guard のみでなく runtime check 必須

**Bad**:
```typescript
import type { PipelineStateSnapshot } from './types';
const snapshot: PipelineStateSnapshot = JSON.parse(data);  // ❌ no validation
```

**Good** — 型ガード + asserting guard:
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
assertPipelineStateSnapshot(snapshot);  // ✅ now type-safe
```

---

## 📁 ディレクトリ構造（参照用）

```
lutchainer/
├─ CLAUDE.md                    ← You are here
├─ .claude/rules/
│  ├─ coding-style.md           ← TypeScript + SolidJS conventions
│  ├─ architecture.md           ← Layer responsibilities & dependencies
│  ├─ patterns.md               ← SolidJS, validation, DnD patterns
│  ├─ specializations.md        ← WebGL, GPU, Interaction specifics
│  └─ common-mistakes.md        ← Runtime edge cases & fixes
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

## 🔗 Quick Reference: 詳細ガイド

分野別ガイドは `.claude/rules/` に分割：

- TypeScript 厳密性、SolidJS JSX 制限、ファイル構成: @.claude/rules/coding-style.md
- CPU↔GPU mismatch、type inference 罠、edge cases: @.claude/rules/common-mistakes.md

---

## ✅ Before You Code

**チェックリスト (AI Agent 向け)**

- [ ] 3層アーキテクチャ (Domain/Rendering/UI) を理解した
- [ ] ファイル命名規約を確認した (`*-model`, `*-state`, `*-controller` etc.)
- [ ] 相対 import path で `../src` を使わないことを確認
- [ ] SolidJS の signal pattern を理解した（createEffect 不要）
- [ ] Domain → Rendering → UI の依存方向を確認した
- [ ] CPU ↔ GPU 色一貫性の texel-center mapping を持つ

上記が曖昧な場合、詳細ガイドを参照してから実装に進んでください。

---

## 🐱 最後に

このプロジェクトは **設計が厳密** です。TS strict mode、層の分離、型安全性が徹底されています。新規機能追加時も、この設計パターンに習うことが最優先。「楽な方法」より「正しい方法」を選択してください。

質問や不明点は、このドキュメントと `.claude/rules/` の該当セクションを参照してからコード実装をお願いします。
