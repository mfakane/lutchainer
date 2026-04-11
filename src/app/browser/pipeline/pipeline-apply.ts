import type { Renderer } from '../../../platforms/webgl/renderer.ts';
import type { ShaderBuildInput } from '../../../features/shader/shader-generator.ts';
import { getShaderGenerator } from '../../../features/shader/shader-generator.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';

export interface PipelineApplyControllerOptions {
  getShaderBuildInput: () => ShaderBuildInput;
  renderer: Renderer;
  isAutoApplyEnabled: () => boolean;
  onUpdateShaderCodePanel: (frag: string) => void;
  onStatus: (message: string, kind: 'success' | 'error' | 'info') => void;
  t: AppTranslator;
  autoApplyDelayMs?: number;
}

function assertValidOptions(options: PipelineApplyControllerOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('PipelineApplyController: options が不正です。');
  }
  if (typeof options.getShaderBuildInput !== 'function') {
    throw new Error('PipelineApplyController: getShaderBuildInput は関数で指定してください。');
  }
  if (!(options.renderer instanceof Object)) {
    throw new Error('PipelineApplyController: renderer が不正です。');
  }
  if (typeof options.isAutoApplyEnabled !== 'function') {
    throw new Error('PipelineApplyController: isAutoApplyEnabled は関数で指定してください。');
  }
  if (typeof options.onUpdateShaderCodePanel !== 'function') {
    throw new Error('PipelineApplyController: onUpdateShaderCodePanel は関数で指定してください。');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('PipelineApplyController: onStatus は関数で指定してください。');
  }
  if (typeof options.t !== 'function') {
    throw new Error('PipelineApplyController: t は関数で指定してください。');
  }
}

export interface PipelineApplyController {
  applyNow: () => void;
  scheduleApply: () => void;
  cancelPending: () => void;
}

export function createPipelineApplyController(
  options: PipelineApplyControllerOptions,
): PipelineApplyController {
  assertValidOptions(options);

  const delayMs = options.autoApplyDelayMs ?? 220;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function applyNow(): void {
    const glslGenerator = getShaderGenerator('glsl');
    const input = options.getShaderBuildInput();
    const lutError = options.renderer.setLutTextures(input.luts.map(l => l.image));
    if (lutError) {
      options.onStatus(lutError, 'error');
      return;
    }

    const frag = glslGenerator.buildFragment(input);
    const vertex = glslGenerator.buildVertex;
    if (typeof vertex !== 'function') {
      throw new Error('GLSL generator does not provide a vertex shader.');
    }
    options.onUpdateShaderCodePanel(frag);
    const result = options.renderer.compileProgram(vertex(), frag);

    if (result.success) {
      options.onStatus(
        options.t('main.status.applySuccess', { steps: input.steps.length, luts: input.luts.length }),
        'success',
      );
    } else {
      const msgs = result.errors.map(e => `[${e.type.toUpperCase()}]\n${e.message.trim()}`).join('\n\n');
      options.onStatus(msgs, 'error');
    }
  }

  function scheduleApply(): void {
    if (!options.isAutoApplyEnabled()) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      applyNow();
      timer = null;
    }, delayMs);
  }

  function cancelPending(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return { applyNow, scheduleApply, cancelPending };
}
