import {
  createConnectionDrawScheduler,
  renderConnectionLayer,
} from './connection-renderer.ts';
import {
  setupLutReorderBindings,
  setupSocketPointerBindings,
  setupStepReorderBindings,
} from './features/pipeline/pipeline-dnd-bindings.ts';
import { createPipelineIoSystem } from './features/pipeline/pipeline-io-system.ts';
import * as pipelineModel from './features/pipeline/pipeline-model.ts';
import {
  getLuts as getPipelineLuts,
  getNextStepId as getPipelineNextStepId,
  getSteps as getPipelineSteps,
  replacePipelineState,
  setLuts as setPipelineLuts,
  setNextStepId as setPipelineNextStepId,
  setSteps as setPipelineSteps,
} from './features/pipeline/pipeline-state.ts';
import * as pipelineView from './features/pipeline/pipeline-view.ts';
import * as shaderGenerator from './features/shader/shader-generator.ts';
import { StepPreviewRenderer } from './features/step/step-preview-renderer.ts';
import { createStepPreviewSystem } from './features/step/step-preview-system.ts';
import {
  type ParamName,
  type StepModel,
} from './features/step/types.ts';
import { createGizmoOverlayController } from './gizmo-overlay.ts';
import {
  mountHeaderActionGroup,
  mountLanguageSwitcher,
  syncHeaderActionAutoApplyState
} from './shared/components/solid-header-actions.tsx';
import {
  mountLightPanel,
  mountMaterialPanel,
  syncLightPanelState,
  syncMaterialPanelState,
} from './shared/components/solid-panels.tsx';
import {
  mountLutStripList,
  mountParamNodeList,
  mountStepList,
  syncLutStripListState,
  syncStepListState,
} from './shared/components/solid-pipeline-lists.tsx';
import {
  mountPreviewShapeBar,
  syncPreviewShapeBarState,
  type PreviewShapeType,
} from './shared/components/solid-preview-shape-bar.tsx';
import {
  mountShaderDialogShell,
  syncShaderDialogState,
} from './shared/components/solid-shader-dialog.tsx';
import {
  mountStatusLog,
  syncStatusLogState,
} from './shared/components/solid-status.tsx';
import {
  getLanguage,
  subscribeLanguageChange,
  t,
} from './shared/i18n.ts';
import {
  getLinearDropPlacement,
  reorderItemsById,
  updatePointerDragStateForMove,
  type LinearDropCandidate,
} from './shared/interactions/dnd.ts';
import {
  setupOrbitPointerControls,
  setupPipelinePanelResizer,
  setupPreviewPanelLayoutResizer,
} from './shared/interactions/layout-interactions.ts';
import {
  applySocketDropConnection,
  cleanupSocketDragInteraction,
  createSocketDropTargetResolver,
  handleSocketDragEnd as processSocketDragEnd,
  handleSocketDragMove as processSocketDragMove,
  syncSocketDropTargetState
} from './shared/interactions/socket-dnd.ts';
import { createRenderSystem } from './shared/rendering/render-system.ts';
import { Renderer } from './shared/rendering/renderer.ts';
import {
  clearLutReorderDragState,
  clearSocketDragState,
  clearStepReorderDragState,
  getLutReorderDragState,
  getSocketDragState,
  getSocketDropTargetState,
  getStepReorderDragState,
  getSuppressClickUntil,
  setLutReorderDragState,
  setSocketDragState,
  setSocketDropTargetState,
  setStepReorderDragState,
  setSuppressClickUntil,
} from './shared/ui/interaction-state.ts';
import {
  getLightSettings,
  getMaterialSettings,
  setLightSettings,
  setMaterialSettings
} from './shared/ui/scene-state.ts';
import {
  isAutoApplyEnabled,
  setAutoApplyEnabled,
} from './shared/ui/ui-state.ts';
import { createCube, createSphere, createTorus } from './shared/utils/geometry.ts';

type PrimitiveType = PreviewShapeType;
type SocketAxis = pipelineView.SocketAxis;
type SocketDropTarget = pipelineView.SocketDropTarget;

interface StaticTranslationTarget {
  selector: string;
  key: string;
  attribute?: 'textContent' | 'aria-label';
}

interface StepPreviewDebugApiResult {
  ok: boolean;
  forceCpu: boolean;
  message: string;
}

interface StepPreviewDebugApi {
  forceCpu: (value: unknown) => StepPreviewDebugApiResult;
  isForceCpu: () => boolean;
}

const STEP_PREVIEW_DEBUG_GLOBAL_KEY = '__debugStepPreview';
const STATIC_TRANSLATION_TARGETS: StaticTranslationTarget[] = [
  {
    selector: '#pipeline-help-text',
    key: 'static.pipelineHelp',
    attribute: 'textContent',
  },
  {
    selector: '#preview-help-text',
    key: 'static.previewHelp',
    attribute: 'textContent',
  },
  {
    selector: '#preview-layout-resizer',
    key: 'static.previewResizerAria',
    attribute: 'aria-label',
  },
];

const parseStepId = pipelineModel.parseStepId;
const parseLutId = pipelineModel.parseLutId;
const isValidParamName = pipelineModel.isValidParamName;
const isValidSocketAxis = pipelineView.isValidSocketAxis;
const createBuiltinLuts = pipelineModel.createBuiltinLuts;
const createLutFromFile = pipelineModel.createLutFromFile;
const MAX_LUTS = pipelineModel.MAX_LUTS;
const resolveSocketDropTargetForDrag = createSocketDropTargetResolver({
  parseStepId,
  isValidSocketAxis,
  isValidParamName,
});

function syncMaterialPanel(): void {
  syncMaterialPanelState(getMaterialSettings());
}

function syncLightPanel(): void {
  syncLightPanelState(getLightSettings());
}

let renderer: Renderer;
let stepPreviewRenderer: StepPreviewRenderer | null = null;
let currentPrimitive: PrimitiveType = 'sphere';

let orbitPitchDeg = 25.0;
let orbitYawDeg = 45.0;
let orbitDist = 2.8;

let applyTimer: ReturnType<typeof setTimeout> | null = null;

let pipelineWorkspaceEl: HTMLElement;
let stepListEl: HTMLElement;
let lutStripListEl: HTMLElement;
let paramNodeListEl: HTMLElement;
let connectionLayerEl: SVGSVGElement;
let lightGizmoLayerEl: SVGSVGElement;
let lightGizmoOriginEl: SVGCircleElement;
let lightGizmoTipEl: SVGCircleElement;
let lightGizmoLabelEl: SVGTextElement;
let axisGizmoLayerEl: SVGSVGElement;
let axisGizmoOriginEl: SVGCircleElement;
let axisGizmoLineXEl: SVGPathElement;
let axisGizmoLineYEl: SVGPathElement;
let axisGizmoLineZEl: SVGPathElement;
let axisGizmoTipXEl: SVGCircleElement;
let axisGizmoTipYEl: SVGCircleElement;
let axisGizmoTipZEl: SVGCircleElement;
let axisGizmoLabelXEl: SVGTextElement;
let axisGizmoLabelYEl: SVGTextElement;
let axisGizmoLabelZEl: SVGTextElement;
let paramColumnEl: HTMLElement;
let gizmoOverlayController: ReturnType<typeof createGizmoOverlayController> | null = null;
let renderSystem: ReturnType<typeof createRenderSystem> | null = null;
let stepPreviewSystem: ReturnType<typeof createStepPreviewSystem> | null = null;
let pipelineIoSystem: ReturnType<typeof createPipelineIoSystem> | null = null;

const connectionDrawScheduler = createConnectionDrawScheduler({
  draw: () => {
    renderConnectionLayer({
      pipelineWorkspaceEl,
      connectionLayerEl,
      steps: getPipelineSteps(),
      socketDragState: getSocketDragState(),
      socketDropTarget: getSocketDropTargetState(),
    });
  },
});

function $<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Required DOM element was not found: ${selector}`);
  }
  return el;
}

function syncStaticLocaleText(): void {
  document.documentElement.setAttribute('lang', getLanguage());

  for (const target of STATIC_TRANSLATION_TARGETS) {
    const element = document.querySelector(target.selector);
    if (!element) {
      continue;
    }

    const translated = t(target.key);
    if (target.attribute === 'aria-label') {
      element.setAttribute('aria-label', translated);
      continue;
    }

    element.textContent = translated;
  }
}

function getLightDirectionWorld(): [number, number, number] {
  return pipelineModel.getLightDirectionWorld(getLightSettings());
}

function getShaderBuildInput(): shaderGenerator.ShaderBuildInput {
  return {
    steps: getPipelineSteps(),
    luts: getPipelineLuts(),
    materialSettings: getMaterialSettings(),
  };
}

function updateShaderCodePanel(fragmentShader?: string): void {
  syncShaderDialogState(getShaderBuildInput(), fragmentShader);
}

function showStatus(message: string, kind: 'success' | 'error' | 'info' = 'info'): void {
  syncStatusLogState({
    message,
    kind,
  });
}

function setStepPreviewForceCpu(value: unknown): StepPreviewDebugApiResult {
  if (!stepPreviewSystem) {
    const message = t('main.status.stepPreviewNotInitialized');
    showStatus(message, 'error');
    return {
      ok: false,
      forceCpu: false,
      message,
    };
  }

  const result = stepPreviewSystem.setForceCpu(value);
  if (!result.ok) {
    showStatus(result.message, 'error');
    return result;
  }

  updateStepSwatches();
  showStatus(
    t('main.status.stepPreviewCpuMode', {
      state: result.forceCpu ? t('common.on') : t('common.off'),
    }),
    'info',
  );
  return result;
}

function isClickSuppressed(): boolean {
  return performance.now() < getSuppressClickUntil();
}

function applyLoadedPipeline(loaded: pipelineModel.LoadedPipelineData): void {
  replacePipelineState({
    luts: loaded.luts,
    steps: loaded.steps,
    nextStepId: loaded.nextStepId,
  });
  renderSteps();
  if (applyTimer !== null) {
    clearTimeout(applyTimer);
    applyTimer = null;
  }
  showStatus(t('main.status.pipelineLoadedApplying'), 'info');
  applyPipelineNow();
}

function buildGeometry(type: PrimitiveType) {
  switch (type) {
    case 'sphere': return createSphere(1.0, 40, 40);
    case 'cube': return createCube(1.6);
    case 'torus': return createTorus(0.65, 0.28, 48, 24);
  }
}

function setActiveShape(type: PrimitiveType): void {
  currentPrimitive = type;
  renderer.uploadGeometry(buildGeometry(type));
  syncPreviewShapeBarState(type);
}

function getStepById(stepId: number): StepModel | null {
  const step = pipelineModel.getStepById(getPipelineSteps(), stepId);
  if (!step) {
    showStatus(t('main.status.stepNotFound', { stepId }), 'error');
    return null;
  }
  return step;
}

function normalizeSteps(): void {
  pipelineModel.normalizeSteps(getPipelineSteps(), getPipelineLuts());
}

function addStep(): void {
  const steps = getPipelineSteps();
  const luts = getPipelineLuts();
  const result = pipelineModel.createPipelineStep(steps, luts, getPipelineNextStepId());
  if (!result.step) {
    if (result.error) {
      showStatus(result.error, 'error');
    }
    return;
  }

  setPipelineNextStepId(result.nextStepId);
  const step = result.step;
  steps.push(step);
  renderSteps();
  scheduleApply();
}

function removeStep(stepId: number): void {
  const result = pipelineModel.removeStepFromPipeline(getPipelineSteps(), stepId);
  if (!result.removed) {
    showStatus(t('main.status.removeStepNotFound', { stepId }), 'error');
    return;
  }
  setPipelineSteps(result.steps);
  renderSteps();
  scheduleApply();
}

function removeLut(lutId: string): void {
  const result = pipelineModel.removeLutFromPipeline(getPipelineLuts(), getPipelineSteps(), lutId);
  if (result.error) {
    showStatus(result.error, 'error');
    return;
  }

  setPipelineLuts(result.luts);
  setPipelineSteps(result.steps);
  renderSteps();
  scheduleApply();
  if (result.removed) {
    showStatus(t('main.status.lutRemoved', { name: result.removed.name }), 'info');
  }
}

function renderLutStrip(): void {
  const steps = getPipelineSteps();
  const luts = getPipelineLuts();
  syncLutStripListState(luts, steps);
}

function scheduleConnectionDraw(): void {
  connectionDrawScheduler.schedule();
}

function renderSteps(): void {
  const steps = getPipelineSteps();
  const luts = getPipelineLuts();
  stepPreviewSystem?.bumpPipelineVersion();
  syncStepListState(steps, luts);
  renderLutStrip();
  updateShaderCodePanel();

  if (steps.length === 0) {
    scheduleConnectionDraw();
    return;
  }

  updateStepSwatches();
  scheduleConnectionDraw();
}

function updateStepSwatches(): void {
  if (!stepPreviewSystem) {
    return;
  }

  const steps = getPipelineSteps();
  const materialSettings = getMaterialSettings();
  if (steps.length === 0) {
    return;
  }

  const canUseWebglPreview = stepPreviewSystem.ensureStepPreviewProgram();

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    if (!step || !Number.isInteger(step.id) || step.id <= 0) {
      continue;
    }

    const stepId = step.id;
    const afterCanvas = stepListEl.querySelector<HTMLCanvasElement>(`.preview-sphere[data-step-id="${stepId}"][data-preview="after"]`);
    if (!afterCanvas) continue;

    if (canUseWebglPreview && stepPreviewRenderer) {
      const drawError = stepPreviewRenderer.drawToCanvas(afterCanvas, {
        targetStepIndex: index,
        baseColor: materialSettings.baseColor,
        ambientColor: materialSettings.ambientColor,
        specularStrength: materialSettings.specularStrength,
        specularPower: materialSettings.specularPower,
        fresnelStrength: materialSettings.fresnelStrength,
        fresnelPower: materialSettings.fresnelPower,
        lightDirection: pipelineModel.STEP_PREVIEW_LIGHT_DIR,
      });

      if (!drawError) {
        continue;
      }

      stepPreviewSystem.reportError(
        t('main.status.stepPreviewWebglDrawFailed', { message: drawError }),
      );
    }

    stepPreviewSystem.drawSpherePreview(afterCanvas, index);
  }
}

function assignParamToSocket(stepId: number, axis: SocketAxis, param: ParamName): boolean {
  const step = getStepById(stepId);
  if (!step) return false;

  if (axis === 'x') step.xParam = param;
  else step.yParam = param;

  renderSteps();
  scheduleApply();
  return true;
}

function clearSocketDropTarget(): void {
  setSocketDropTarget(null);
}

function setSocketDropTarget(nextTarget: SocketDropTarget | null): void {
  syncSocketDropTargetState({
    currentTarget: getSocketDropTargetState(),
    nextTarget,
    setState: setSocketDropTargetState,
  });
}

function handleSocketDragMove(event: PointerEvent): void {
  processSocketDragMove({
    event,
    socketDragState: getSocketDragState(),
    updateDragState: (dragState, clientX, clientY) => updatePointerDragStateForMove(dragState, clientX, clientY),
    setSocketDragState,
    resolveDropTarget: resolveSocketDropTargetForDrag,
    setSocketDropTarget,
    onDragStart: dragState => {
      dragState.sourceEl.classList.add('socket-source-active');
      document.body.style.userSelect = 'none';
    },
    onDragProgress: scheduleConnectionDraw,
  });
}

function handleSocketDragEnd(event: PointerEvent): void {
  processSocketDragEnd({
    event,
    socketDragState: getSocketDragState(),
    resolveDropTarget: resolveSocketDropTargetForDrag,
    applyDropConnection: (dragState, dropTarget) => applySocketDropConnection({
      dragState,
      dropTarget,
      assignParamToSocket,
    }),
    onDidDrag: () => {
      setSuppressClickUntil(performance.now() + 240);
    },
    onApplied: () => {
      showStatus(t('main.status.socketConnected'), 'info');
    },
    cleanup: () => {
      cleanupSocketDragInteraction({
        socketDragState: getSocketDragState(),
        clearSocketDragState,
        clearSocketDropTarget,
        clearUserSelect: () => {
          document.body.style.userSelect = '';
        },
        onAfterCleanup: scheduleConnectionDraw,
      });
    },
  });
}

function clearStepDropIndicators(): void {
  pipelineView.clearStepDropIndicators(stepListEl);
}

function updateStepDropIndicators(): void {
  pipelineView.updateStepDropIndicators(stepListEl, getStepReorderDragState());
}

function getStepDropPlacement(clientY: number): { stepId: number | null; after: boolean } {
  const stepReorderDragState = getStepReorderDragState();
  const candidates: LinearDropCandidate<number>[] = [];

  for (const item of Array.from(stepListEl.querySelectorAll<HTMLElement>('.step-item'))) {
    const itemStepId = parseStepId(item.dataset.stepId);
    if (itemStepId === null || itemStepId === stepReorderDragState?.stepId) {
      continue;
    }

    const rect = item.getBoundingClientRect();
    candidates.push({
      id: itemStepId,
      midpoint: rect.top + rect.height * 0.5,
    });
  }

  const placement = getLinearDropPlacement(candidates, clientY);
  return { stepId: placement.targetId, after: placement.after };
}

function moveStepToPosition(stepId: number, targetStepId: number | null, after: boolean): void {
  const steps = getPipelineSteps();
  const draggedExists = steps.some(step => step.id === stepId);
  if (!draggedExists) {
    showStatus(t('main.status.moveStepNotFound', { stepId }), 'error');
    return;
  }

  const nextSteps = reorderItemsById(steps, stepId, targetStepId, after, step => step.id);
  if (!nextSteps) return;

  setPipelineSteps(nextSteps);
  renderSteps();
  scheduleApply();
  showStatus(t('main.status.stepOrderUpdated'), 'info');
}

function clearLutDropIndicators(): void {
  pipelineView.clearLutDropIndicators(lutStripListEl);
}

function updateLutDropIndicators(): void {
  pipelineView.updateLutDropIndicators(lutStripListEl, getLutReorderDragState());
}

function getLutDropPlacement(clientX: number): { lutId: string | null; after: boolean } {
  const lutReorderDragState = getLutReorderDragState();
  const candidates: LinearDropCandidate<string>[] = [];

  for (const item of Array.from(lutStripListEl.querySelectorAll<HTMLElement>('.lut-strip-item'))) {
    const lutId = item.dataset.lutId;
    if (!lutId || lutId === lutReorderDragState?.lutId) {
      continue;
    }

    const rect = item.getBoundingClientRect();
    candidates.push({
      id: lutId,
      midpoint: rect.left + rect.width * 0.5,
    });
  }

  const placement = getLinearDropPlacement(candidates, clientX);
  return { lutId: placement.targetId, after: placement.after };
}

function moveLutToPosition(lutId: string, targetLutId: string | null, after: boolean): void {
  const luts = getPipelineLuts();
  const draggedExists = luts.some(lut => lut.id === lutId);
  if (!draggedExists) {
    showStatus(t('main.status.moveLutNotFound'), 'error');
    return;
  }

  const nextLuts = reorderItemsById(luts, lutId, targetLutId, after, lut => lut.id);
  if (!nextLuts) return;

  setPipelineLuts(nextLuts);
  renderSteps();
  scheduleApply();
  showStatus(t('main.status.lutOrderUpdated'), 'info');
}

function applyPipelineNow(): void {
  const steps = getPipelineSteps();
  const luts = getPipelineLuts();
  const lutError = renderer.setLutTextures(luts.map(l => l.image));
  if (lutError) {
    showStatus(lutError, 'error');
    return;
  }

  const frag = shaderGenerator.buildFragmentShader(getShaderBuildInput());
  updateShaderCodePanel(frag);
  const result = renderer.compileProgram(shaderGenerator.DEFAULT_VERT, frag);

  if (result.success) {
    showStatus(t('main.status.applySuccess', { steps: steps.length, luts: luts.length }), 'success');
  } else {
    const msgs = result.errors.map(e => `[${e.type.toUpperCase()}]\n${e.message.trim()}`).join('\n\n');
    showStatus(msgs, 'error');
  }
}

function scheduleApply(): void {
  if (!isAutoApplyEnabled()) return;
  if (applyTimer !== null) clearTimeout(applyTimer);
  applyTimer = setTimeout(() => {
    applyPipelineNow();
    applyTimer = null;
  }, 220);
}

function setupMaterialPanel(): void {
  const panel = $<HTMLElement>('#material-panel');
  mountMaterialPanel(panel, {
    initialSettings: getMaterialSettings(),
    onSettingsChange: nextSettings => {
      setMaterialSettings(nextSettings);
      updateStepSwatches();
      updateShaderCodePanel();
      scheduleApply();
    },
    onStatus: showStatus,
  });

  syncMaterialPanel();
  updateShaderCodePanel();
}

function setupLightPanel(): void {
  const panel = $<HTMLElement>('#light-panel');
  mountLightPanel(panel, {
    initialSettings: getLightSettings(),
    onSettingsChange: nextSettings => {
      const wasVisible = getLightSettings().showGizmo;
      setLightSettings(nextSettings);
      const lightSettings = getLightSettings();
      updateShaderCodePanel();

      if (wasVisible && !lightSettings.showGizmo) {
        lightGizmoLayerEl.style.opacity = '0';
      }
    },
    onStatus: showStatus,
  });

  syncLightPanel();
}

function setupShaderPanel(): void {
  mountShaderDialogShell({
    dialogEl: $<HTMLDialogElement>('#shader-dialog'),
    openButtonEl: $<HTMLButtonElement>('#btn-open-shader-dialog'),
    surfaceEl: $<Element>('.shader-dialog-surface'),
    onBeforeOpen: () => {
      updateShaderCodePanel();
    },
    onStatus: showStatus,
  });

  syncShaderDialogState(getShaderBuildInput());
}

function setupUI(): void {
  mountLanguageSwitcher($<HTMLElement>('#header-language-switcher'));
  mountHeaderActionGroup($<HTMLElement>('#header-action-group'), {
    initialAutoApplyEnabled: isAutoApplyEnabled(),
    onResetPipeline: () => {
      replacePipelineState({
        luts: getPipelineLuts(),
        steps: [],
        nextStepId: 1,
      });
      addStep();
      showStatus(t('main.status.resetStepChain'), 'info');
    },
    onSavePipeline: async () => {
      if (!pipelineIoSystem) {
        showStatus(t('main.status.pipelineIoNotInitialized'), 'error');
        return;
      }

      const result = await pipelineIoSystem.savePipelineAsFile();
      if (result.ok) {
        showStatus(t('main.status.pipelineSaved'), 'success');
        return;
      }

      showStatus(
        t('main.status.pipelineSaveFailed', {
          message: result.errorMessage ?? t('common.unknownError'),
        }),
        'error',
      );
    },
    onApplyPipeline: () => {
      applyPipelineNow();
    },
    onPipelineFileSelected: async file => {
      if (!pipelineIoSystem) {
        showStatus(t('main.status.pipelineIoNotInitialized'), 'error');
        return;
      }

      const result = await pipelineIoSystem.loadPipelineFromFile(file);
      if (!result.ok || !result.loaded) {
        showStatus(
          t('main.status.pipelineLoadFailed', {
            message: result.errorMessage ?? t('common.unknownError'),
          }),
          'error',
        );
        return;
      }

      applyLoadedPipeline(result.loaded);
    },
    onAutoApplyChange: enabled => {
      setAutoApplyEnabled(enabled);
      syncHeaderActionAutoApplyState(isAutoApplyEnabled());
      if (isAutoApplyEnabled()) scheduleApply();
    },
    onStatus: showStatus,
  });

  mountPreviewShapeBar($<HTMLElement>('#preview-shape-bar'), {
    initialShape: currentPrimitive,
    onShapeChange: nextShape => {
      setActiveShape(nextShape);
    },
    onStatus: showStatus,
  });

  setupMaterialPanel();
  setupLightPanel();
  setupShaderPanel();

  setupLutReorderBindings({
    lutStripListEl,
    parseLutId,
    getLutDropPlacement,
    getLutReorderDragState,
    setLutReorderDragState,
    clearLutReorderDragState,
    updateLutDropIndicators,
    clearLutDropIndicators,
    moveLutToPosition,
    onStatus: showStatus,
  });

  setupSocketPointerBindings({
    paramNodeListEl,
    stepListEl,
    parseStepId,
    isValidParamName,
    isValidSocketAxis,
    setSocketDragState,
    handleSocketDragMove,
    handleSocketDragEnd,
    onStatus: showStatus,
  });

  setupStepReorderBindings({
    stepListEl,
    parseStepId,
    getStepDropPlacement,
    getStepReorderDragState,
    setStepReorderDragState,
    clearStepReorderDragState,
    updateStepDropIndicators,
    clearStepDropIndicators,
    moveStepToPosition,
    onStatus: showStatus,
  });

  stepListEl.addEventListener('scroll', () => scheduleConnectionDraw());
  paramColumnEl.addEventListener('scroll', () => scheduleConnectionDraw());
  window.addEventListener('resize', () => {
    scheduleConnectionDraw();
    updateStepSwatches();
  });

  setActiveShape('sphere');
}

window.addEventListener('DOMContentLoaded', () => {
  syncStaticLocaleText();

  const disposeLanguageSync = subscribeLanguageChange(() => {
    syncStaticLocaleText();
  });

  window.addEventListener('beforeunload', () => {
    disposeLanguageSync();
  }, { once: true });

  pipelineWorkspaceEl = $<HTMLElement>('#pipeline-workspace');
  stepListEl = $<HTMLElement>('#step-list');
  lutStripListEl = $<HTMLElement>('#lut-strip-list');
  paramNodeListEl = $<HTMLElement>('#param-node-list');
  connectionLayerEl = $<SVGSVGElement>('#connection-layer');
  lightGizmoLayerEl = $<SVGSVGElement>('#light-gizmo-layer');
  lightGizmoOriginEl = $<SVGCircleElement>('#light-gizmo-origin');
  lightGizmoTipEl = $<SVGCircleElement>('#light-gizmo-tip');
  lightGizmoLabelEl = $<SVGTextElement>('#light-gizmo-label');
  axisGizmoLayerEl = $<SVGSVGElement>('#axis-gizmo-layer');
  axisGizmoOriginEl = $<SVGCircleElement>('#axis-gizmo-origin');
  axisGizmoLineXEl = $<SVGPathElement>('#axis-gizmo-line-x');
  axisGizmoLineYEl = $<SVGPathElement>('#axis-gizmo-line-y');
  axisGizmoLineZEl = $<SVGPathElement>('#axis-gizmo-line-z');
  axisGizmoTipXEl = $<SVGCircleElement>('#axis-gizmo-tip-x');
  axisGizmoTipYEl = $<SVGCircleElement>('#axis-gizmo-tip-y');
  axisGizmoTipZEl = $<SVGCircleElement>('#axis-gizmo-tip-z');
  axisGizmoLabelXEl = $<SVGTextElement>('#axis-gizmo-label-x');
  axisGizmoLabelYEl = $<SVGTextElement>('#axis-gizmo-label-y');
  axisGizmoLabelZEl = $<SVGTextElement>('#axis-gizmo-label-z');
  paramColumnEl = $<HTMLElement>('.param-column');

  gizmoOverlayController = createGizmoOverlayController({
    light: {
      layer: lightGizmoLayerEl,
      origin: lightGizmoOriginEl,
      tip: lightGizmoTipEl,
      label: lightGizmoLabelEl,
    },
    axis: {
      layer: axisGizmoLayerEl,
      origin: axisGizmoOriginEl,
      lineX: axisGizmoLineXEl,
      lineY: axisGizmoLineYEl,
      lineZ: axisGizmoLineZEl,
      tipX: axisGizmoTipXEl,
      tipY: axisGizmoTipYEl,
      tipZ: axisGizmoTipZEl,
      labelX: axisGizmoLabelXEl,
      labelY: axisGizmoLabelYEl,
      labelZ: axisGizmoLabelZEl,
    },
  });

  const canvas = $<HTMLCanvasElement>('#gl-canvas');
  renderer = new Renderer(canvas);
  stepPreviewRenderer = StepPreviewRenderer.create();
  stepPreviewSystem = createStepPreviewSystem({
    getSteps: getPipelineSteps,
    getLuts: getPipelineLuts,
    getMaterialSettings,
    getStepPreviewRenderer: () => stepPreviewRenderer,
    onError: message => showStatus(message, 'error'),
    lightDirection: pipelineModel.STEP_PREVIEW_LIGHT_DIR,
    viewDirection: pipelineModel.STEP_PREVIEW_VIEW_DIR,
  });

  const stepPreviewDebugApi: StepPreviewDebugApi = {
    forceCpu: (value: unknown): StepPreviewDebugApiResult => setStepPreviewForceCpu(value),
    isForceCpu: () => stepPreviewSystem?.isForceCpu() ?? false,
  };

  // Debug helper: use window.__debugStepPreview.forceCpu(true/false) from browser console.
  (window as unknown as Record<string, unknown>)[STEP_PREVIEW_DEBUG_GLOBAL_KEY] = stepPreviewDebugApi;

  pipelineIoSystem = createPipelineIoSystem({
    getNextStepId: getPipelineNextStepId,
    getLuts: getPipelineLuts,
    getSteps: getPipelineSteps,
    renderPreviewPngBytes: async () => {
      if (!stepPreviewSystem) {
        throw new Error(t('main.status.stepPreviewNotInitialized'));
      }
      return await stepPreviewSystem.renderPreviewPngBytes();
    },
    maxPipelineFileBytes: pipelineModel.MAX_PIPELINE_FILE_BYTES,
    serializePipelineAsZip: pipelineModel.serializePipelineAsZip,
    buildPipelineDownloadFilename: pipelineModel.buildPipelineDownloadFilename,
    loadPipelineFromZip: pipelineModel.loadPipelineFromZip,
    loadPipelineData: pipelineModel.loadPipelineData,
    isZipLikeFile: pipelineModel.isZipLikeFile,
    isJsonLikeFile: pipelineModel.isJsonLikeFile,
    toErrorMessage: pipelineModel.toErrorMessage,
  });

  renderSystem = createRenderSystem({
    renderer,
    getCameraOrbit: () => ({
      orbitPitchDeg,
      orbitYawDeg,
      orbitDist,
    }),
    getLightSettings,
    getLightDirectionWorld,
    getMaterialSettings,
    onAfterDraw: ({ view, proj, canvas: drawCanvas, lightDirection, lightSettings }) => {
      if (!gizmoOverlayController) {
        return;
      }

      gizmoOverlayController.updateLightDirectionGizmo({
        view,
        proj,
        canvas: drawCanvas,
        lightDirectionWorld: lightDirection,
        showGizmo: lightSettings.showGizmo,
      });
      gizmoOverlayController.updateAxisGizmo({ view });
    },
  });

  replacePipelineState({
    luts: createBuiltinLuts(),
    steps: [],
    nextStepId: 1,
  });

  mountStatusLog($<HTMLElement>('#error-log'), {
    initialMessage: t('main.status.initialPrompt'),
    initialKind: 'info',
  });

  mountParamNodeList(paramNodeListEl, {
    onStatus: showStatus,
  });
  mountStepList(stepListEl, {
    steps: getPipelineSteps(),
    luts: getPipelineLuts(),
    onAddStep: () => {
      addStep();
    },
    onRemoveStep: stepId => {
      removeStep(stepId);
    },
    onStepLutChange: (stepId, lutId) => {
      const step = getStepById(stepId);
      if (!step) return;
      step.lutId = lutId;
      renderSteps();
      scheduleApply();
    },
    onStepBlendModeChange: (stepId, blendMode) => {
      const step = getStepById(stepId);
      if (!step) return;
      step.blendMode = blendMode;
      renderSteps();
      scheduleApply();
    },
    onStepOpChange: (stepId, channel, op) => {
      const step = getStepById(stepId);
      if (!step) return;
      step.ops[channel] = op;
      stepPreviewSystem?.bumpPipelineVersion();
      updateStepSwatches();
      updateShaderCodePanel();
      scheduleApply();
    },
    shouldSuppressClick: isClickSuppressed,
    onStatus: showStatus,
  });
  mountLutStripList(lutStripListEl, {
    luts: getPipelineLuts(),
    steps: getPipelineSteps(),
    onRemoveLut: lutId => {
      removeLut(lutId);
    },
    onAddLutFiles: async files => {
      if (!Array.isArray(files) || files.some(file => !(file instanceof File))) {
        showStatus(t('main.status.invalidLutAddInput'), 'error');
        return;
      }

      const luts = getPipelineLuts();
      const room = Math.max(0, MAX_LUTS - luts.length);
      if (room === 0) {
        showStatus(t('main.status.maxLutLimit', { max: MAX_LUTS }), 'error');
        return;
      }

      const selected = files.slice(0, room);
      const errors: string[] = [];
      let added = 0;

      for (const file of selected) {
        try {
          const lut = await createLutFromFile(file);
          luts.push(lut);
          added += 1;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : `${t('common.unknownError')}: ${file.name}`);
        }
      }

      normalizeSteps();
      renderSteps();
      scheduleApply();

      if (errors.length > 0) {
        showStatus(errors.join('\n'), 'error');
      } else {
        showStatus(t('main.status.lutAdded', { count: added }), 'success');
      }
    },
    onStatus: showStatus,
  });

  renderLutStrip();
  setupUI();
  setupPipelinePanelResizer({
    panel: $<HTMLElement>('#pipeline-panel'),
    resizer: $<HTMLElement>('#resizer'),
    onResized: scheduleConnectionDraw,
  });
  setupPreviewPanelLayoutResizer({
    previewPanel: $<HTMLElement>('.preview-panel'),
    previewDisplay: $<HTMLElement>('#preview-display-section'),
    previewResizer: $<HTMLElement>('#preview-layout-resizer'),
    onStatus: showStatus,
  });
  setupOrbitPointerControls({
    canvas,
    getOrbitState: () => ({
      orbitPitchDeg,
      orbitYawDeg,
      orbitDist,
    }),
    setOrbitState: nextState => {
      orbitPitchDeg = nextState.orbitPitchDeg;
      orbitYawDeg = nextState.orbitYawDeg;
      orbitDist = nextState.orbitDist;
    },
  });

  addStep();
  applyPipelineNow();
  if (renderSystem && !renderSystem.isRunning()) {
    renderSystem.start();
  }

  scheduleConnectionDraw();
});
