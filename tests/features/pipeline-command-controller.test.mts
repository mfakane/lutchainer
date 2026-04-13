/**
 * Tests for pipeline command controller.
 * Validates: step management, LUT operations, custom parameters, parameter assignment, reordering.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPipelineCommandController } from '../../src/features/pipeline/pipeline-command-controller.ts';
import type { PipelineStateSnapshot } from '../../src/features/pipeline/pipeline-state.ts';
import {
    createCustomParam,
    createTestLut,
    createTestStep
} from '../fixtures/step-test-fixtures.mts';

/**
 * Helper: Create a test snapshot.
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
 * Helper: Create a mock translator.
 */
function createMockTranslator() {
  return <K extends string>(key: K, ..._args: unknown[]) => key; // Simple pass-through for testing
}

/**
 * Helper: Create a command controller with mocked state.
 */
function createTestCommandController(options?: {
  initialSnapshot?: PipelineStateSnapshot;
}) {
  let currentSnapshot = options?.initialSnapshot ?? createTestSnapshot();
  let renderCalls = 0;
  let applyCalls = 0;
  const statusMessages: Array<{ message: string; kind: string }> = [];

  const controller = createPipelineCommandController({
    maxStepLabelLength: 40,
    getSteps: () => currentSnapshot.steps,
    setSteps: (steps) => {
      currentSnapshot.steps = steps;
    },
    getLuts: () => currentSnapshot.luts,
    setLuts: (luts) => {
      currentSnapshot.luts = luts;
    },
    getCustomParams: () => currentSnapshot.customParams,
    setCustomParams: (customParams) => {
      currentSnapshot.customParams = customParams;
    },
    parseLutId: (value) => {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      return null;
    },
    isValidParamName: (value): value is never => false, // Not used in basic tests
    isValidSocketAxis: (value): value is never => false, // Not used in basic tests
    captureSnapshot: () => ({
      steps: currentSnapshot.steps.map(s => ({ ...s, ops: { ...s.ops } })),
      luts: currentSnapshot.luts,
      customParams: currentSnapshot.customParams,
    }),
    commitSnapshot: (before) => {
      // Simple history (not testing history here)
      return true;
    },
    renderSteps: () => {
      renderCalls++;
    },
    scheduleApply: () => {
      applyCalls++;
    },
    status: (message, kind) => {
      statusMessages.push({ message, kind: kind ?? 'info' });
    },
    t: createMockTranslator(),
  });

  return {
    controller,
    getCurrentSnapshot: () => currentSnapshot,
    setSnapshot: (snapshot: PipelineStateSnapshot) => {
      currentSnapshot = snapshot;
    },
    getRenderCalls: () => renderCalls,
    getApplyCalls: () => applyCalls,
    getStatusMessages: () => statusMessages,
  };
}

test('Pipeline command controller - addStep adds step to empty pipeline', () => {
  const { controller, getCurrentSnapshot } = createTestCommandController();

  controller.addStep();

  assert.equal(getCurrentSnapshot().steps.length, 1, 'step added');
  assert(getCurrentSnapshot().steps[0]?.id, 'step has id');
});

test('Pipeline command controller - addStep with multiple calls', () => {
  const { controller, getCurrentSnapshot } = createTestCommandController();

  controller.addStep();
  controller.addStep();
  controller.addStep();

  assert.equal(getCurrentSnapshot().steps.length, 3, '3 steps added');
});

test('Pipeline command controller - addStep with LUT succeeds', () => {
  const lut = createTestLut({ id: 'test-lut' });
  const { controller, getCurrentSnapshot } = createTestCommandController({
    initialSnapshot: createTestSnapshot({ luts: [lut] }),
  });

  controller.addStep();

  assert.equal(getCurrentSnapshot().steps.length, 1, 'step added');
  assert.equal(getCurrentSnapshot().steps[0]?.lutId, 'test-lut', 'new step uses first available LUT');
  assert.equal(getCurrentSnapshot().steps[0]?.blendMode, 'multiply', 'new step uses default blend mode');
  assert.equal(getCurrentSnapshot().steps[0]?.xParam, 'lightness', 'new step uses default x param');
  assert.equal(getCurrentSnapshot().steps[0]?.yParam, 'facing', 'new step uses default y param');
});

test('Pipeline command controller - setStepMuted toggles mute state', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const step = createTestStep('step-1');
  setSnapshot(createTestSnapshot({ steps: [step] }));

  controller.setStepMuted('step-1', true);

  assert.equal(getCurrentSnapshot().steps[0]!.muted, true, 'step muted');

  controller.setStepMuted('step-1', false);

  assert.equal(getCurrentSnapshot().steps[0]!.muted, false, 'step unmuted');
});

test('Pipeline command controller - setStepMuted with invalid value shows error', () => {
  const { controller, getStatusMessages } = createTestCommandController({
    initialSnapshot: createTestSnapshot({ steps: [createTestStep('step-1')] }),
  });

  controller.setStepMuted('step-1', 'invalid');

  const messages = getStatusMessages();
  assert(messages.length > 0, 'error message generated');
  assert.equal(messages[messages.length - 1]?.kind, 'error', 'error kind');
});

test('Pipeline command controller - setStepMuted with non-existent step', () => {
  const { controller, getStatusMessages } = createTestCommandController();

  controller.setStepMuted('non-existent', true);

  const messages = getStatusMessages();
  assert(messages.length > 0, 'error message for missing step');
});

test('Pipeline command controller - setStepLabel updates label', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const step = createTestStep('step-1');
  setSnapshot(createTestSnapshot({ steps: [step] }));

  controller.setStepLabel('step-1', 'New Label');

  assert.equal(getCurrentSnapshot().steps[0]!.label, 'New Label', 'label updated');
});

test('Pipeline command controller - setStepLabel clears with null', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const step = { ...createTestStep('step-1'), label: 'Old Label' };
  setSnapshot(createTestSnapshot({ steps: [step] }));

  controller.setStepLabel('step-1', null);

  assert.equal(getCurrentSnapshot().steps[0]!.label, undefined, 'label cleared');
});

test('Pipeline command controller - setStepLabel respects max length', () => {
  const { controller, setSnapshot, getCurrentSnapshot, getStatusMessages } = createTestCommandController();

  const step = { ...createTestStep('step-1'), label: 'Old Label' };
  setSnapshot(createTestSnapshot({ steps: [step] }));

  const longLabel = 'a'.repeat(100); // Exceeds 40 char limit
  controller.setStepLabel('step-1', longLabel);

  assert.equal(getCurrentSnapshot().steps[0]!.label, 'Old Label', 'too-long label is rejected without mutating step');
  const messages = getStatusMessages();
  assert.equal(messages[messages.length - 1]?.kind, 'error', 'too-long label reports validation error');
});

test('Pipeline command controller - duplicateStep creates copy', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const step = createTestStep('step-1');
  setSnapshot(createTestSnapshot({ steps: [step], luts: [createTestLut()] }));

  controller.duplicateStep('step-1');

  assert.equal(getCurrentSnapshot().steps.length, 2, 'step duplicated');
  assert.notEqual(getCurrentSnapshot().steps[1]?.id, 'step-1', 'duplicate has different id');
});

test('Pipeline command controller - removeStep deletes step', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const step1 = createTestStep('step-1');
  const step2 = createTestStep('step-2');
  setSnapshot(createTestSnapshot({ steps: [step1, step2] }));

  controller.removeStep('step-1');

  assert.equal(getCurrentSnapshot().steps.length, 1, 'step removed');
  assert.equal(getCurrentSnapshot().steps[0]?.id, 'step-2', 'correct step removed');
});

test('Pipeline command controller - removeStep with non-existent step', () => {
  const { controller, getStatusMessages } = createTestCommandController();

  controller.removeStep('non-existent');

  const messages = getStatusMessages();
  assert(messages.length > 0, 'error message for missing step');
});

test('Pipeline command controller - setStepLut changes LUT reference', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const lut1 = createTestLut({ id: 'lut-1' });
  const lut2 = createTestLut({ id: 'lut-2' });
  const step = createTestStep('step-1');

  setSnapshot(createTestSnapshot({
    steps: [step],
    luts: [lut1, lut2],
  }));

  controller.setStepLut('step-1', 'lut-2');

  assert.equal(getCurrentSnapshot().steps[0]?.lutId, 'lut-2', 'step LUT updated');
});

test('Pipeline command controller - setStepLut validates LUT exists', () => {
  const { controller, setSnapshot, getStatusMessages } = createTestCommandController();

  const step = createTestStep('step-1');
  setSnapshot(createTestSnapshot({ steps: [step], luts: [createTestLut({ id: 'lut-1' })] }));

  controller.setStepLut('step-1', 'lut-999');

  const messages = getStatusMessages();
  assert(messages.length > 0, 'error message for missing LUT');
});

test('Pipeline command controller - addCustomParam adds new parameter', () => {
  const { controller, getCurrentSnapshot } = createTestCommandController();

  controller.addCustomParam();

  assert.equal(getCurrentSnapshot().customParams.length, 1, 'custom param added');
});

test('Pipeline command controller - renameCustomParam updates label', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const param = createCustomParam('gain', 0.5);
  setSnapshot(createTestSnapshot({ customParams: [param] }));

  controller.renameCustomParam('gain', 'New Gain');

  assert.equal(getCurrentSnapshot().customParams[0]?.label, 'New Gain', 'param label updated');
});

test('Pipeline command controller - setCustomParamValue clamps to [0,1]', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const param = createCustomParam('gain', 0.5);
  setSnapshot(createTestSnapshot({ customParams: [param] }));

  controller.setCustomParamValue('gain', 1.5);

  assert.equal(getCurrentSnapshot().customParams[0]?.defaultValue, 1.0, 'value clamped to 1.0');

  controller.setCustomParamValue('gain', -0.5);

  assert.equal(getCurrentSnapshot().customParams[0]?.defaultValue, 0.0, 'value clamped to 0.0');
});

test('Pipeline command controller - removeCustomParam deletes parameter', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const param1 = createCustomParam('gain', 0.5);
  const param2 = createCustomParam('bias', 0.25);
  setSnapshot(createTestSnapshot({ customParams: [param1, param2] }));

  controller.removeCustomParam('gain');

  assert.equal(getCurrentSnapshot().customParams.length, 1, 'param removed');
  assert.equal(getCurrentSnapshot().customParams[0]?.id, 'bias', 'correct param removed');
});

test('Pipeline command controller - moveStepToPosition reorders steps', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const step1 = createTestStep('step-1');
  const step2 = createTestStep('step-2');
  const step3 = createTestStep('step-3');
  setSnapshot(createTestSnapshot({ steps: [step1, step2, step3] }));

  controller.moveStepToPosition('step-1', 'step-3', true);

  const ids = getCurrentSnapshot().steps.map(s => s.id);
  assert.deepEqual(ids, ['step-2', 'step-3', 'step-1'], 'step order updated exactly');
});

test('Pipeline command controller - moveLutToPosition reorders LUTs', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const lut1 = createTestLut({ id: 'lut-1' });
  const lut2 = createTestLut({ id: 'lut-2' });
  const lut3 = createTestLut({ id: 'lut-3' });
  setSnapshot(createTestSnapshot({ luts: [lut1, lut2, lut3] }));

  controller.moveLutToPosition('lut-1', 'lut-3', true);

  const ids = getCurrentSnapshot().luts.map(l => l.id);
  assert.deepEqual(ids, ['lut-2', 'lut-3', 'lut-1'], 'lut order updated exactly');
});

test('Pipeline command controller - setStepLabel with type error shows message', () => {
  const { controller, setSnapshot, getStatusMessages } = createTestCommandController();

  const step = createTestStep('step-1');
  setSnapshot(createTestSnapshot({ steps: [step] }));

  controller.setStepLabel('step-1', { invalid: 'object' });

  const messages = getStatusMessages();
  assert(messages.length > 0, 'error message shown');
  assert.equal(messages[messages.length - 1]?.kind, 'error');
});

test('Pipeline command controller - renderSteps called after step modification', () => {
  const { controller, setSnapshot, getRenderCalls } = createTestCommandController();

  const step = createTestStep('step-1');
  setSnapshot(createTestSnapshot({ steps: [step] }));

  const beforeCalls = getRenderCalls();
  controller.setStepMuted('step-1', true);
  const afterCalls = getRenderCalls();

  assert.equal(afterCalls, beforeCalls + 1, 'renderSteps called exactly once after modification');
});

test('Pipeline command controller - scheduleApply called after step addition', () => {
  const { controller, getApplyCalls } = createTestCommandController();

  const beforeCalls = getApplyCalls();
  controller.addStep();
  const afterCalls = getApplyCalls();

  assert.equal(afterCalls, beforeCalls + 1, 'scheduleApply called exactly once after addStep');
});

test('Pipeline command controller - moveCustomParamToPosition reorders params', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const param1 = createCustomParam('gain', 0.5);
  const param2 = createCustomParam('bias', 0.25);
  const param3 = createCustomParam('offset', 0.1);
  setSnapshot(createTestSnapshot({ customParams: [param1, param2, param3] }));

  controller.moveCustomParamToPosition('gain', 'offset', true);

  const ids = getCurrentSnapshot().customParams.map(p => p.id);
  assert.deepEqual(ids, ['bias', 'offset', 'gain'], 'custom param order updated exactly');
});

test('Pipeline command controller - duplicateLut creates copy', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const lut = createTestLut({ id: 'lut-1' });
  setSnapshot(createTestSnapshot({ luts: [lut] }));

  controller.duplicateLut('lut-1');

  assert.equal(getCurrentSnapshot().luts.length, 2, 'lut duplicated');
  assert.notEqual(getCurrentSnapshot().luts[1]?.id, 'lut-1', 'duplicate has different id');
});

test('Pipeline command controller - removeLut deletes LUT', () => {
  const { controller, setSnapshot, getCurrentSnapshot } = createTestCommandController();

  const lut1 = createTestLut({ id: 'lut-1' });
  const lut2 = createTestLut({ id: 'lut-2' });
  setSnapshot(createTestSnapshot({ luts: [lut1, lut2] }));

  controller.removeLut('lut-1');

  assert.equal(getCurrentSnapshot().luts.length, 1, 'lut removed');
  assert.equal(getCurrentSnapshot().luts[0]?.id, 'lut-2', 'correct lut removed');
});
