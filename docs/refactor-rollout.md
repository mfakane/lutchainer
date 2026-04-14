# Refactor Rollout Guardrails

This document defines the rollout rules for large refactors.

## Scope

Use this checklist when touching architecture boundaries, Solid mount lifecycles, pipeline list rendering, or large cross-cutting UI modules.

## Required Verification

Every refactor PR must pass the following before merge:

1. `npm run typecheck`
2. `npm test`
3. `npm run test:ui`
4. `act -W .github/workflows/test.yml -j verify` when local Docker/act validation is available
5. Manual review with [docs/ui-regression-checklist.md](docs/ui-regression-checklist.md) when the PR changes interactive UI flows

## Change Ordering

Apply large work in this order:

1. Boundary separation
2. Solid lifecycle stabilization
3. Style and token cleanup
4. Larger responsibility splits

Avoid mixing unrelated steps into one PR unless the change would otherwise be untestable.

## PR Size Rule

Prefer small PRs that each preserve green verification.

Good:

- extract a controller and keep old call sites
- add a guard test before moving code
- split one file into parser / orchestrator / adapter modules

Avoid:

- boundary changes plus unrelated UI redesign
- multiple subsystem rewrites without guard tests
- deleting compatibility wrappers in the same PR that introduces a replacement unless all call sites are migrated and verified

## Compatibility Rule

When changing a public or cross-module API:

1. Introduce the replacement API first.
2. Keep the old entry point as a thin compatibility wrapper for one phase when practical.
3. Move call sites to the replacement.
4. Remove the wrapper only after verification is stable.

If a compatibility wrapper is not practical, document the break in the PR description and ensure the migration is fully mechanical within the same PR.

## UI-Specific Risk Areas

These areas require extra care because they are sensitive to rerender timing and DOM replacement:

1. Step list scroll position
2. Parameter column scroll position
3. LUT library horizontal scroll position
4. Connection line redraw after scroll or edit
5. Shader dialog mount / unmount lifecycle
6. Drag-and-drop bindings for LUT, Step, and socket interactions

## Existing Guardrails

The repository already includes these checks:

1. [tests/features/architecture-boundaries.test.mts](tests/features/architecture-boundaries.test.mts)
2. [tests/shared/solid-mount-lifecycle.test.mts](tests/shared/solid-mount-lifecycle.test.mts)
3. [tests/ui/main-ui-smoke.spec.ts](tests/ui/main-ui-smoke.spec.ts)
4. [tests/ui/list-scroll-and-connection-redraw.spec.ts](tests/ui/list-scroll-and-connection-redraw.spec.ts)

Add a new guard test in the same PR whenever a refactor touches a previously unguarded sensitive behavior.