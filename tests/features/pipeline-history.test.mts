/**
 * Tests for pipeline history management (undo/redo).
 * Validates: snapshot capture, history stack operations, equality checks, state restoration.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPipelineHistoryController } from '../../src/features/pipeline/pipeline-history.ts';
import type { PipelineStateSnapshot } from '../../src/features/pipeline/pipeline-state.ts';
import {
    createCustomParam,
    createTestLut,
    createTestStep
} from '../fixtures/step-test-fixtures.mts';

/**
 * Helper: Create a test snapshot with given content.
 */
function createTestSnapshot(overrides?: Partial<PipelineStateSnapshot>): PipelineStateSnapshot {
  return {
    steps: [],
    luts: [],
    customParams: [],
    ...overrides,
  };
}

/**
 * Helper: Create a mock history controller with callbacks.
 */
function createTestController(options?: {
  historyLimit?: number;
  initialSnapshot?: PipelineStateSnapshot;
}) {
  let currentSnapshot = options?.initialSnapshot ?? createTestSnapshot();
  let captureCount = 0;
  let restoreCount = 0;
  let historyStateChanges: Array<{ canUndo: boolean; canRedo: boolean }> = [];

  const controller = createPipelineHistoryController({
    historyLimit: options?.historyLimit ?? 50,
    captureSnapshot: () => {
      captureCount++;
      return {
        steps: [...currentSnapshot.steps],
        luts: [...currentSnapshot.luts],
        customParams: [...currentSnapshot.customParams],
      };
    },
    restoreSnapshot: (snapshot) => {
      restoreCount++;
      currentSnapshot = {
        steps: [...snapshot.steps],
        luts: [...snapshot.luts],
        customParams: [...snapshot.customParams],
      };
    },
    onHistoryStateChange: (canUndo, canRedo) => {
      historyStateChanges.push({ canUndo, canRedo });
    },
  });

  return {
    controller,
    getCurrentSnapshot: () => currentSnapshot,
    setSnapshot: (snapshot: PipelineStateSnapshot) => {
      currentSnapshot = snapshot;
    },
    getCaptureCount: () => captureCount,
    getRestoreCount: () => restoreCount,
    getHistoryStateChanges: () => historyStateChanges,
  };
}

test('Pipeline history - canUndo/canRedo initial state', () => {
  const { controller } = createTestController();

  assert.equal(controller.canUndo(), false, 'initial canUndo is false');
  assert.equal(controller.canRedo(), false, 'initial canRedo is false');
});

test('Pipeline history - commitSnapshot records undo state', () => {
  const { controller, setSnapshot } = createTestController();

  const before = createTestSnapshot({ steps: [createTestStep('step-1')] });
  controller.commitSnapshot(before);

  assert.equal(controller.canUndo(), true, 'canUndo is true after commit');
  assert.equal(controller.canRedo(), false, 'canRedo remains false');
});

test('Pipeline history - undo restores previous state', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestController();

  const step1 = createTestStep('step-1');
  const before = createTestSnapshot({ steps: [step1] });

  controller.commitSnapshot(before);

  // Change snapshot to represent "after"
  setSnapshot(createTestSnapshot({ steps: [step1, createTestStep('step-2')] }));

  const result = controller.undo();

  assert.equal(result, true, 'undo returns true');
  assert.equal(getCurrentSnapshot().steps.length, 1, 'snapshot restored to before state');
  assert.equal(controller.canUndo(), false, 'canUndo is false after undo');
  assert.equal(controller.canRedo(), true, 'canRedo is true after undo');
});

test('Pipeline history - redo restores forward state', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestController();

  const step1 = createTestStep('step-1');
  const before = createTestSnapshot({ steps: [step1] });

  controller.commitSnapshot(before);
  setSnapshot(createTestSnapshot({ steps: [step1, createTestStep('step-2')] }));
  controller.undo();

  const result = controller.redo();

  assert.equal(result, true, 'redo returns true');
  assert.equal(getCurrentSnapshot().steps.length, 2, 'snapshot restored to after state');
  assert.equal(controller.canUndo(), true, 'canUndo is true after redo');
  assert.equal(controller.canRedo(), false, 'canRedo is false after redo');
});

test('Pipeline history - undo/redo cycle preserves data', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestController();

  const step1 = createTestStep('step-1');
  const step2 = createTestStep('step-2');
  const before = createTestSnapshot({ steps: [step1] });

  controller.commitSnapshot(before);
  setSnapshot(createTestSnapshot({ steps: [step1, step2] }));

  // Undo
  controller.undo();
  assert.equal(getCurrentSnapshot().steps.length, 1);

  // Redo
  controller.redo();
  assert.equal(getCurrentSnapshot().steps.length, 2);
  assert.equal(getCurrentSnapshot().steps[0]!.id, 'step-1');
  assert.equal(getCurrentSnapshot().steps[1]!.id, 'step-2');
});

test('Pipeline history - undo with empty stack returns false', () => {
  const { controller } = createTestController();

  const result = controller.undo();

  assert.equal(result, false, 'undo returns false when stack is empty');
  assert.equal(controller.canUndo(), false);
});

test('Pipeline history - redo with empty stack returns false', () => {
  const { controller } = createTestController();

  const result = controller.redo();

  assert.equal(result, false, 'redo returns false when stack is empty');
  assert.equal(controller.canRedo(), false);
});

test('Pipeline history - commitSnapshot on initial state', () => {
  const { controller, setSnapshot } = createTestController();

  const before = createTestSnapshot({ steps: [createTestStep('step-1')] });
  
  // Initial commit should succeed
  controller.commitSnapshot(before);

  // Change state
  setSnapshot(createTestSnapshot({ steps: [createTestStep('step-1'), createTestStep('step-2')] }));

  // Now undo should be possible
  assert.equal(controller.canUndo(), true, 'canUndo true after state change');
});

test('Pipeline history - commitSnapshot clears redo stack', () => {
  const { controller, setSnapshot } = createTestController();

  const step1 = createTestStep('step-1');
  const before = createTestSnapshot({ steps: [step1] });

  controller.commitSnapshot(before);
  setSnapshot(createTestSnapshot({ steps: [step1, createTestStep('step-2')] }));
  controller.undo();

  assert.equal(controller.canRedo(), true, 'canRedo before new commit');

  // New commit should clear redo stack
  setSnapshot(createTestSnapshot({ steps: [step1, createTestStep('step-3')] }));
  controller.commitSnapshot(before);

  assert.equal(controller.canRedo(), false, 'canRedo cleared after new commit');
});

test('Pipeline history - clearHistory removes all undo/redo', () => {
  const { controller, setSnapshot, getHistoryStateChanges } = createTestController();

  const step1 = createTestStep('step-1');
  const before = createTestSnapshot({ steps: [step1] });

  controller.commitSnapshot(before);
  setSnapshot(createTestSnapshot({ steps: [step1, createTestStep('step-2')] }));

  // Only undo if there's actually something to undo
  if (controller.canUndo()) {
    controller.undo();
  }

  controller.clearHistory();

  assert.equal(controller.canUndo(), false, 'canUndo is false after clear');
  assert.equal(controller.canRedo(), false, 'canRedo is false after clear');
});

test('Pipeline history - history limit enforces stack bounds', () => {
  const { controller, setSnapshot } = createTestController({ historyLimit: 3 });

  // Perform 5 commits to exceed limit of 3
  for (let i = 0; i < 5; i++) {
    const before = createTestSnapshot({ steps: [createTestStep(`step-${i}`)] });
    controller.commitSnapshot(before);
    setSnapshot(createTestSnapshot({ steps: [createTestStep(`step-${i}`), createTestStep(`step-${i + 1}`)] }));
  }

  // Count how many undos are possible
  let undoCount = 0;
  while (controller.canUndo() && undoCount < 10) {
    controller.undo();
    undoCount++;
  }

  // Should be limited (not all 5 states available)
  assert(undoCount <= 3, `undo stack limited, got ${undoCount} instead of 5`);
});

test('Pipeline history - multiple undo/redo sequence', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestController();

  // Build history: step-1
  let before = createTestSnapshot({ steps: [createTestStep('step-1')] });
  controller.commitSnapshot(before);

  // step-1, step-2
  setSnapshot(createTestSnapshot({ steps: [createTestStep('step-1'), createTestStep('step-2')] }));
  before = createTestSnapshot({ steps: [createTestStep('step-1')] });
  controller.commitSnapshot(before);

  // step-1, step-2, step-3
  setSnapshot(createTestSnapshot({
    steps: [
      createTestStep('step-1'),
      createTestStep('step-2'),
      createTestStep('step-3'),
    ],
  }));
  before = createTestSnapshot({
    steps: [createTestStep('step-1'), createTestStep('step-2')],
  });
  controller.commitSnapshot(before);

  // Undo 3 times
  controller.undo();
  controller.undo();
  controller.undo();

  assert.equal(getCurrentSnapshot().steps.length, 1, 'after 3 undos, back to start');

  // Redo 2 times
  controller.redo();
  controller.redo();

  assert.equal(getCurrentSnapshot().steps.length, 3, 'after 2 redos, at 3-step state');
});

test('Pipeline history - onHistoryStateChange callback fires correctly', () => {
  const { controller, setSnapshot, getHistoryStateChanges } = createTestController();

  const before = createTestSnapshot({ steps: [createTestStep('step-1')] });
  controller.commitSnapshot(before);

  const changes = getHistoryStateChanges();
  assert.equal(changes.length > 0, true, 'callback was called');

  const lastChange = changes[changes.length - 1];
  assert.equal(lastChange?.canUndo, true, 'callback reports canUndo=true');
  assert.equal(lastChange?.canRedo, false, 'callback reports canRedo=false');
});

test('Pipeline history - snapshot equality with LUTs and custom params', () => {
  const { controller, setSnapshot } = createTestController();

  const lut = createTestLut();
  const customParam = createCustomParam('gain', 0.5);

  const before = createTestSnapshot({
    steps: [createTestStep('step-1')],
    luts: [lut],
    customParams: [customParam],
  });

  controller.commitSnapshot(before);
  setSnapshot(createTestSnapshot({
    steps: [createTestStep('step-1')],
    luts: [lut],
    customParams: [customParam],
  }));

  // No visible change, so commitSnapshot should return false
  const result = controller.commitSnapshot(before);
  assert.equal(result, false, 'identical snapshot not recorded as change');
});

test('Pipeline history - snapshot modification does not affect history', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestController();

  const step1 = createTestStep('step-1');
  const before = createTestSnapshot({ steps: [step1] });

  controller.commitSnapshot(before);

  // Modify original step (should not affect history)
  step1.muted = true;
  setSnapshot(createTestSnapshot({ steps: [createTestStep('step-2')] }));

  controller.undo();

  // Should restore unmodified step-1
  assert.equal(getCurrentSnapshot().steps[0]!.muted, false, 'history snapshot preserved original state');
});

test('Pipeline history - large snapshot handling', () => {
  const { controller, setSnapshot } = createTestController({ historyLimit: 100 });

  const largeSteps = Array.from({ length: 50 }, (_, i) => createTestStep(`step-${i}`));
  const before = createTestSnapshot({ steps: largeSteps });

  controller.commitSnapshot(before);

  const moreSteps = Array.from({ length: 60 }, (_, i) => createTestStep(`step-${i}`));
  setSnapshot(createTestSnapshot({ steps: moreSteps }));

  assert.equal(controller.canUndo(), true, 'handles large snapshots');
  const result = controller.undo();
  assert.equal(result, true, 'undo succeeds on large snapshot');
});
