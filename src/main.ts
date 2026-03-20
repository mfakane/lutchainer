import {
  createConnectionDrawScheduler,
  renderConnectionLayer,
} from './connection-renderer.ts';
import {
  createPipelineCommandController,
} from './features/pipeline/pipeline-command-controller.ts';
import {
  setupPipelineUiInteractions,
} from './features/pipeline/pipeline-ui-interactions.ts';
import {
  createPipelineHistoryController,
} from './features/pipeline/pipeline-history.ts';
import {
  createPipelineHistoryActionsController,
} from './features/pipeline/pipeline-history-actions.ts';
import {
  createPipelineHeaderActionController,
} from './features/pipeline/pipeline-header-actions-controller.ts';
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
import { MAX_STEP_LABEL_LENGTH } from './features/step/step-model.ts';
import { StepPreviewRenderer } from './features/step/step-preview-renderer.ts';
import { setupStepPreviewShapeUi } from './features/step/step-preview-shape-ui.ts';
import { createStepPreviewSystem } from './features/step/step-preview-system.ts';
import { createGizmoOverlayController } from './gizmo-overlay.ts';
import {
  mountHeaderActionGroup,
  mountLanguageSwitcher,
  syncHeaderActionAutoApplyState,
  syncHeaderActionHistoryState,
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
  syncPreviewShapeBarState,
  syncPreviewWireframeState,
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
  setupOrbitPointerControls,
  setupPipelinePanelResizer,
  setupPreviewPanelLayoutResizer,
} from './shared/interactions/layout-interactions.ts';
import {
  createSocketDropTargetResolver,
} from './shared/interactions/socket-dnd.ts';
import {
  createPipelineApplyController,
  type PipelineApplyController,
} from './features/pipeline/pipeline-apply.ts';
import {
  createPipelineDropIndicatorController,
  type PipelineDropIndicatorController,
} from './features/pipeline/pipeline-drop-indicators.ts';
import {
  createPipelineSocketDndController,
  type PipelineSocketDndController,
} from './features/pipeline/pipeline-socket-dnd-controller.ts';
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
import { resolveMainDomElements } from './shared/ui/main-dom-elements.ts';
import {
  getLightSettings,
  getMaterialSettings,
  setLightSettings,
  setMaterialSettings
} from './shared/ui/scene-state.ts';
import {
  isAutoApplyEnabled,
  isPreviewWireframeOverlayEnabled,
  setAutoApplyEnabled,
  setPreviewWireframeOverlayEnabled,
} from './shared/ui/ui-state.ts';
import { createCube, createSphere, createTorus } from './shared/utils/geometry.ts';
import {
  buildPreviewDownloadFilename,
  canvasToPngBlob,
  copyCanvasSnapshot,
  downloadBlobAsFile,
} from './shared/utils/preview-export.ts';
import { updateStepSwatches as updateStepSwatchesHelper } from './features/step/step-swatch-updater.ts';

type PrimitiveType = PreviewShapeType;

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

interface PendingMainPreviewCapture {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface MainPreviewCaptureRequestOptions {
  hideLightGuide?: boolean;
}

const STEP_PREVIEW_DEBUG_GLOBAL_KEY = '__debugStepPreview';
const MAIN_PREVIEW_CAPTURE_TIMEOUT_MS = 2000;
const PIPELINE_HISTORY_LIMIT = 100;
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
let pipelineApply: PipelineApplyController;
let pipelineDropIndicators: PipelineDropIndicatorController;
let pipelineSocketDnd: PipelineSocketDndController;
let stepPreviewRenderer: StepPreviewRenderer | null = null;
let currentPrimitive: PrimitiveType = 'sphere';

let orbitPitchDeg = 25.0;
let orbitYawDeg = 45.0;
let orbitDist = 2.8;

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
let pendingMainPreviewCapture: PendingMainPreviewCapture | null = null;
let suppressLightGuideForMainPreviewCapture = false;

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

const pipelineHistory = createPipelineHistoryController({
  historyLimit: PIPELINE_HISTORY_LIMIT,
  captureSnapshot: () => ({
    steps: getPipelineSteps(),
    luts: getPipelineLuts(),
    nextStepId: getPipelineNextStepId(),
  }),
  restoreSnapshot: snapshot => {
    replacePipelineState(snapshot);
    renderSteps();
    pipelineApply.scheduleApply();
  },
  onHistoryStateChange: (canUndo, canRedo) => {
    syncHeaderActionHistoryState(canUndo, canRedo);
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

const pipelineHistoryActions = createPipelineHistoryActionsController({
  history: pipelineHistory,
  onStatus: showStatus,
  t,
});





function settleMainPreviewCaptureFromFrame(canvas: HTMLCanvasElement): void {
  const pending = pendingMainPreviewCapture;
  if (!pending) {
    return;
  }

  pendingMainPreviewCapture = null;
  suppressLightGuideForMainPreviewCapture = false;
  clearTimeout(pending.timeoutHandle);

  let snapshot: HTMLCanvasElement;
  try {
    snapshot = copyCanvasSnapshot(canvas);
  } catch (error) {
    pending.reject(error instanceof Error ? error : new Error(t('common.unknownError')));
    return;
  }

  canvasToPngBlob(snapshot)
    .then(blob => pending.resolve(blob))
    .catch(error => {
      pending.reject(error instanceof Error ? error : new Error(t('common.unknownError')));
    });
}

function requestMainPreviewPngBlob(options?: MainPreviewCaptureRequestOptions): Promise<Blob> {
  if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) {
    return Promise.reject(new Error('キャプチャオプションが不正です。'));
  }

  const hideLightGuideRaw = options?.hideLightGuide;
  if (hideLightGuideRaw !== undefined && typeof hideLightGuideRaw !== 'boolean') {
    return Promise.reject(new Error('hideLightGuide は boolean で指定してください。'));
  }

  if (pendingMainPreviewCapture) {
    return Promise.reject(new Error(t('main.status.previewExportBusy')));
  }

  suppressLightGuideForMainPreviewCapture = hideLightGuideRaw ?? false;

  return new Promise<Blob>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      const pending = pendingMainPreviewCapture;
      if (!pending || pending.timeoutHandle !== timeoutHandle) {
        return;
      }

      pendingMainPreviewCapture = null;
      suppressLightGuideForMainPreviewCapture = false;
      pending.reject(new Error(t('main.status.previewExportCaptureTimeout')));
    }, MAIN_PREVIEW_CAPTURE_TIMEOUT_MS);

    pendingMainPreviewCapture = {
      resolve,
      reject,
      timeoutHandle,
    };
  });
}

async function exportMainPreviewPng(): Promise<void> {
  if (!(renderer instanceof Renderer)) {
    throw new Error(t('main.status.previewExportRendererMissing'));
  }

  if (!renderSystem) {
    throw new Error(t('main.status.previewExportRendererMissing'));
  }

  if (!renderSystem.isRunning()) {
    renderSystem.start();
  }

  const blob = await requestMainPreviewPngBlob({ hideLightGuide: true });
  downloadBlobAsFile(blob, buildPreviewDownloadFilename('main'));
  showStatus(t('main.status.previewExportMainSaved'), 'success');
}

async function exportStepPreviewPng(): Promise<void> {
  if (!stepPreviewSystem) {
    throw new Error(t('main.status.stepPreviewNotInitialized'));
  }

  const bytes = await stepPreviewSystem.renderPreviewPngBytes();
  if (!(bytes instanceof Uint8Array) || bytes.byteLength <= 0) {
    throw new Error(t('main.status.previewExportBytesInvalid'));
  }

  const blob = new Blob([(bytes.buffer as ArrayBuffer).slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
    type: 'image/png',
  });
  downloadBlobAsFile(blob, buildPreviewDownloadFilename('step'));
  showStatus(t('main.status.previewExportStepSaved'), 'success');
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
  pipelineHistoryActions.clearHistory();
  renderSteps();
  pipelineApply.cancelPending();
  showStatus(t('main.status.pipelineLoadedApplying'), 'info');
  pipelineApply.applyNow();
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

function setWireframeOverlayEnabled(enabled: unknown): void {
  if (typeof enabled !== 'boolean') {
    showStatus(t('main.status.wireframeInvalidValue', { value: String(enabled) }), 'error');
    return;
  }

  if (!(renderer instanceof Renderer)) {
    showStatus(t('main.status.previewExportRendererMissing'), 'error');
    return;
  }

  setPreviewWireframeOverlayEnabled(enabled);
  renderer.setWireframeOverlayEnabled(enabled);
  syncPreviewWireframeState(isPreviewWireframeOverlayEnabled());
  showStatus(
    t('main.status.wireframeChanged', {
      state: enabled ? t('common.on') : t('common.off'),
    }),
    'info',
  );
}

function normalizeSteps(): void {
  pipelineModel.normalizeSteps(getPipelineSteps(), getPipelineLuts());
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
  if (steps.length === 0) {
    return;
  }

  updateStepSwatchesHelper({
    stepListEl,
    steps,
    materialSettings: getMaterialSettings(),
    lightSettings: getLightSettings(),
    stepPreviewRenderer,
    canUseWebglPreview: stepPreviewSystem.ensureStepPreviewProgram(),
    drawSpherePreviewCpu: (canvas, index) => stepPreviewSystem!.drawSpherePreview(canvas, index),
    onWebglDrawError: message =>
      stepPreviewSystem!.reportError(
        t('main.status.stepPreviewWebglDrawFailed', { message }),
      ),
  });
}

const pipelineCommands = createPipelineCommandController({
  maxStepLabelLength: MAX_STEP_LABEL_LENGTH,
  getSteps: getPipelineSteps,
  setSteps: setPipelineSteps,
  getLuts: getPipelineLuts,
  setLuts: setPipelineLuts,
  getNextStepId: getPipelineNextStepId,
  setNextStepId: setPipelineNextStepId,
  parseLutId,
  isValidParamName,
  isValidSocketAxis,
  captureSnapshot: () => pipelineHistoryActions.captureSnapshot(),
  commitSnapshot: before => pipelineHistoryActions.commitSnapshot(before),
  renderSteps,
  scheduleApply: () => pipelineApply.scheduleApply(),
  onStepOpsChanged: () => {
    stepPreviewSystem?.bumpPipelineVersion();
    updateStepSwatches();
    updateShaderCodePanel();
  },
  status: showStatus,
  t,
});

pipelineSocketDnd = createPipelineSocketDndController({
  getSocketDragState,
  setSocketDragState,
  clearSocketDragState,
  getSocketDropTargetState,
  setSocketDropTargetState,
  resolveDropTarget: resolveSocketDropTargetForDrag,
  assignParamToSocket: pipelineCommands.assignParamToSocket,
  scheduleConnectionDraw,
  setSuppressClickUntil,
  setUserSelect: value => {
    document.body.style.userSelect = value;
  },
  onStatus: showStatus,
  t,
  now: () => performance.now(),
});

const pipelineHeaderActions = createPipelineHeaderActionController({
  isAutoApplyEnabled,
  canUndo: () => pipelineHistory.canUndo(),
  canRedo: () => pipelineHistory.canRedo(),
  onUndoPipeline: () => {
    pipelineHistoryActions.undo();
  },
  onRedoPipeline: () => {
    pipelineHistoryActions.redo();
  },
  onResetPipelineState: () => {
    replacePipelineState({
      luts: getPipelineLuts(),
      steps: [],
      nextStepId: 1,
    });
    pipelineHistoryActions.clearHistory();
    pipelineCommands.addStep({ recordHistory: false });
  },
  onApplyPipeline: () => {
    pipelineApply.applyNow();
  },
  onApplyLoadedPipeline: loaded => {
    applyLoadedPipeline(loaded);
  },
  getPipelineIoSystem: () => pipelineIoSystem,
  setAutoApplyEnabled,
  syncAutoApplyState: syncHeaderActionAutoApplyState,
  scheduleApply: () => pipelineApply.scheduleApply(),
  onStatus: showStatus,
  t,
});

function setupMaterialPanel(): void {
  const panel = $<HTMLElement>('#material-panel');
  mountMaterialPanel(panel, {
    initialSettings: getMaterialSettings(),
    onSettingsChange: nextSettings => {
      setMaterialSettings(nextSettings);
      updateStepSwatches();
      updateShaderCodePanel();
      pipelineApply.scheduleApply();
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
  mountHeaderActionGroup($<HTMLElement>('#header-action-group'), pipelineHeaderActions.buildMountOptions());

  setupStepPreviewShapeUi({
    target: $<HTMLElement>('#preview-shape-bar'),
    initialShape: currentPrimitive,
    isWireframeEnabled: isPreviewWireframeOverlayEnabled,
    onShapeChange: nextShape => {
      setActiveShape(nextShape);
    },
    onWireframeChange: enabled => {
      setWireframeOverlayEnabled(enabled);
    },
    onExportMainPreviewPng: async () => {
      await exportMainPreviewPng();
    },
    onExportStepPreviewPng: async () => {
      await exportStepPreviewPng();
    },
    onStatus: showStatus,
  });

  setupMaterialPanel();
  setupLightPanel();
  setupShaderPanel();

  setupPipelineUiInteractions({
    dndBindings: {
      lutReorder: {
        lutStripListEl,
        parseLutId,
        getLutDropPlacement: pipelineDropIndicators.getLutDropPlacement,
        getLutReorderDragState,
        setLutReorderDragState,
        clearLutReorderDragState,
        updateLutDropIndicators: pipelineDropIndicators.updateLutDropIndicators,
        clearLutDropIndicators: pipelineDropIndicators.clearLutDropIndicators,
        moveLutToPosition: pipelineCommands.moveLutToPosition,
        onStatus: showStatus,
      },
      socketPointer: {
        paramNodeListEl,
        stepListEl,
        parseStepId,
        isValidParamName,
        isValidSocketAxis,
        setSocketDragState,
        handleSocketDragMove: pipelineSocketDnd.handleSocketDragMove,
        handleSocketDragEnd: pipelineSocketDnd.handleSocketDragEnd,
        onStatus: showStatus,
      },
      stepReorder: {
        stepListEl,
        parseStepId,
        getStepDropPlacement: pipelineDropIndicators.getStepDropPlacement,
        getStepReorderDragState,
        setStepReorderDragState,
        clearStepReorderDragState,
        updateStepDropIndicators: pipelineDropIndicators.updateStepDropIndicators,
        clearStepDropIndicators: pipelineDropIndicators.clearStepDropIndicators,
        moveStepToPosition: pipelineCommands.moveStepToPosition,
        onStatus: showStatus,
      },
    },
    stepListEl,
    paramColumnEl,
    onScheduleConnectionDraw: scheduleConnectionDraw,
    onUpdateStepSwatches: updateStepSwatches,
    onUndoPipeline: pipelineHistoryActions.undo,
    onRedoPipeline: pipelineHistoryActions.redo,
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

  ({
    pipelineWorkspaceEl,
    stepListEl,
    lutStripListEl,
    paramNodeListEl,
    connectionLayerEl,
    lightGizmoLayerEl,
    lightGizmoOriginEl,
    lightGizmoTipEl,
    lightGizmoLabelEl,
    axisGizmoLayerEl,
    axisGizmoOriginEl,
    axisGizmoLineXEl,
    axisGizmoLineYEl,
    axisGizmoLineZEl,
    axisGizmoTipXEl,
    axisGizmoTipYEl,
    axisGizmoTipZEl,
    axisGizmoLabelXEl,
    axisGizmoLabelYEl,
    axisGizmoLabelZEl,
    paramColumnEl,
  } = resolveMainDomElements({ select: $ }));

  pipelineDropIndicators = createPipelineDropIndicatorController({
    stepListEl,
    lutStripListEl,
    parseStepId,
    getStepReorderDragState,
    getLutReorderDragState,
  });

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
  pipelineApply = createPipelineApplyController({
    getShaderBuildInput,
    renderer,
    isAutoApplyEnabled,
    onUpdateShaderCodePanel: frag => updateShaderCodePanel(frag),
    onStatus: showStatus,
    t,
  });
  renderer.setWireframeOverlayEnabled(isPreviewWireframeOverlayEnabled());
  stepPreviewRenderer = StepPreviewRenderer.create();
  stepPreviewSystem = createStepPreviewSystem({
    getSteps: getPipelineSteps,
    getLuts: getPipelineLuts,
    getMaterialSettings,
    getLightSettings,
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
    shouldSuppressLightGuide: () => suppressLightGuideForMainPreviewCapture,
    onAfterDraw: ({ view, proj, canvas: drawCanvas, lightDirection, lightSettings }) => {
      settleMainPreviewCaptureFromFrame(drawCanvas);

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
  pipelineHistoryActions.clearHistory();

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
      pipelineCommands.addStep();
    },
    onDuplicateStep: stepId => {
      pipelineCommands.duplicateStep(stepId);
    },
    onRemoveStep: stepId => {
      pipelineCommands.removeStep(stepId);
    },
    onStepMuteChange: (stepId, muted) => {
      pipelineCommands.setStepMuted(stepId, muted);
    },
    onStepLabelChange: (stepId, label) => {
      pipelineCommands.setStepLabel(stepId, label);
    },
    onStepLutChange: (stepId, lutId) => {
      pipelineCommands.setStepLut(stepId, lutId);
    },
    onStepBlendModeChange: (stepId, blendMode) => {
      pipelineCommands.setStepBlendMode(stepId, blendMode);
    },
    onStepOpChange: (stepId, channel, op) => {
      pipelineCommands.setStepChannelOp(stepId, channel, op);
    },
    shouldSuppressClick: isClickSuppressed,
    onStatus: showStatus,
  });
  mountLutStripList(lutStripListEl, {
    luts: getPipelineLuts(),
    steps: getPipelineSteps(),
    onRemoveLut: lutId => {
      pipelineCommands.removeLut(lutId);
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
      const before = pipelineHistoryActions.captureSnapshot();

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
      pipelineHistoryActions.commitSnapshot(before);
      renderSteps();
      pipelineApply.scheduleApply();

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

  pipelineCommands.addStep({ recordHistory: false });
  pipelineApply.applyNow();
  if (renderSystem && !renderSystem.isRunning()) {
    renderSystem.start();
  }

  scheduleConnectionDraw();
});
