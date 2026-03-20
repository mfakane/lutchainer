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
import {
  createStepPreviewDebugController,
} from './features/step/step-preview-debug-controller.ts';
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
  syncLutStripListState,
  syncStepListState,
} from './shared/components/solid-pipeline-lists.tsx';
import {
  syncPreviewShapeBarState,
  syncPreviewWireframeState,
} from './shared/components/solid-preview-shape-bar.tsx';
import {
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
import { setupStaticLocaleSync } from './shared/i18n/static-locale-sync.ts';
import {
  createSocketDropTargetResolver,
} from './shared/interactions/socket-dnd.ts';
import {
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
import { setupMainLayoutControls } from './shared/ui/main-layout-controls-setup.ts';
import { setupMainPipelineLists } from './shared/ui/main-pipeline-lists-setup.ts';
import { setupMainPanels } from './shared/ui/main-panels-setup.ts';
import { setupMainPreviewRuntime } from './shared/ui/main-preview-runtime-setup.ts';
import {
  type PreviewShapeController,
} from './shared/ui/preview-shape-controller.ts';
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
import {
  createMainPreviewCaptureController,
  type MainPreviewCaptureController,
} from './shared/ui/main-preview-capture-controller.ts';
import { updateStepSwatches as updateStepSwatchesHelper } from './features/step/step-swatch-updater.ts';

interface StaticTranslationTarget {
  selector: string;
  key: string;
  attribute?: 'textContent' | 'aria-label';
}

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
const resolveSocketDropTargetForDrag = createSocketDropTargetResolver({
  parseStepId,
  isValidSocketAxis,
  isValidParamName,
});

let renderer: Renderer;
let pipelineApply: PipelineApplyController;
let pipelineDropIndicators: PipelineDropIndicatorController;
let pipelineSocketDnd: PipelineSocketDndController;
let previewShapeController: PreviewShapeController;
let stepPreviewRenderer: StepPreviewRenderer | null = null;

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
let mainPreviewCapture: MainPreviewCaptureController;

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
  mainPreviewCapture.settleFromFrame(canvas);
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

const stepPreviewDebugController = createStepPreviewDebugController({
  getStepPreviewSystem: () => stepPreviewSystem,
  onUpdateStepSwatches: updateStepSwatches,
  onStatus: showStatus,
  t,
});

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

function setupUI(): void {
  mountLanguageSwitcher($<HTMLElement>('#header-language-switcher'));
  mountHeaderActionGroup($<HTMLElement>('#header-action-group'), pipelineHeaderActions.buildMountOptions());

  setupStepPreviewShapeUi({
    target: $<HTMLElement>('#preview-shape-bar'),
    initialShape: previewShapeController.getCurrentShape(),
    isWireframeEnabled: isPreviewWireframeOverlayEnabled,
    onShapeChange: nextShape => {
      previewShapeController.setActiveShape(nextShape);
    },
    onWireframeChange: enabled => {
      previewShapeController.setWireframeOverlayEnabled(enabled);
    },
    onExportMainPreviewPng: async () => {
      await mainPreviewCapture.exportMainPreviewPng();
    },
    onExportStepPreviewPng: async () => {
      await mainPreviewCapture.exportStepPreviewPng();
    },
    onStatus: showStatus,
  });

  setupMainPanels({
    materialPanelEl: $<HTMLElement>('#material-panel'),
    lightPanelEl: $<HTMLElement>('#light-panel'),
    shaderDialogEl: $<HTMLDialogElement>('#shader-dialog'),
    shaderOpenButtonEl: $<HTMLButtonElement>('#btn-open-shader-dialog'),
    shaderSurfaceEl: $<Element>('.shader-dialog-surface'),
    lightGizmoLayerEl,
    getMaterialSettings,
    setMaterialSettings,
    getLightSettings,
    setLightSettings,
    getShaderBuildInput,
    onUpdateStepSwatches: updateStepSwatches,
    onUpdateShaderCodePanel: () => {
      updateShaderCodePanel();
    },
    onScheduleApply: () => {
      pipelineApply.scheduleApply();
    },
    onStatus: showStatus,
  });

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

  previewShapeController.setActiveShape('sphere');
}

window.addEventListener('DOMContentLoaded', () => {
  setupStaticLocaleSync({
    syncStaticLocaleText,
    subscribeLanguageChange,
  });

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
  ({
    renderer,
    pipelineApply,
    previewShapeController,
    stepPreviewRenderer,
    stepPreviewSystem,
  } = setupMainPreviewRuntime({
    canvas,
    getShaderBuildInput,
    isAutoApplyEnabled,
    onUpdateShaderCodePanel: frag => updateShaderCodePanel(frag),
    onStatus: showStatus,
    t,
    getWireframeEnabled: isPreviewWireframeOverlayEnabled,
    setWireframeEnabled: setPreviewWireframeOverlayEnabled,
    syncPreviewShapeState: syncPreviewShapeBarState,
    syncPreviewWireframeState,
    getSteps: getPipelineSteps,
    getLuts: getPipelineLuts,
    getMaterialSettings,
    getLightSettings,
    stepPreviewLightDirection: pipelineModel.STEP_PREVIEW_LIGHT_DIR,
    stepPreviewViewDirection: pipelineModel.STEP_PREVIEW_VIEW_DIR,
  }));

  // Debug helper: use window.__debugStepPreview.forceCpu(true/false) from browser console.
  stepPreviewDebugController.registerGlobalDebugApi({
    globalObject: window as unknown as Record<string, unknown>,
  });

  mainPreviewCapture = createMainPreviewCaptureController({
    getRenderer: () => renderer,
    getRenderSystem: () => renderSystem,
    getStepPreviewSystem: () => stepPreviewSystem,
    onStatus: showStatus,
    t,
  });

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
    shouldSuppressLightGuide: () => mainPreviewCapture.isSuppressLightGuide(),
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

  setupMainPipelineLists({
    paramNodeListEl,
    stepListEl,
    lutStripListEl,
    getSteps: getPipelineSteps,
    getLuts: getPipelineLuts,
    shouldSuppressClick: isClickSuppressed,
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
    onRemoveLut: lutId => {
      pipelineCommands.removeLut(lutId);
    },
    createLutFromFile: pipelineModel.createLutFromFile,
    maxLuts: pipelineModel.MAX_LUTS,
    captureHistorySnapshot: () => pipelineHistoryActions.captureSnapshot(),
    commitHistorySnapshot: before => pipelineHistoryActions.commitSnapshot(before),
    normalizeSteps,
    renderSteps,
    scheduleApply: () => pipelineApply.scheduleApply(),
    renderLutStrip,
    onStatus: showStatus,
    t,
  });

  setupUI();
  setupMainLayoutControls({
    canvas,
    pipelinePanel: $<HTMLElement>('#pipeline-panel'),
    pipelineResizer: $<HTMLElement>('#resizer'),
    previewPanel: $<HTMLElement>('.preview-panel'),
    previewDisplay: $<HTMLElement>('#preview-display-section'),
    previewResizer: $<HTMLElement>('#preview-layout-resizer'),
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
    onPanelResized: scheduleConnectionDraw,
    onStatus: showStatus,
  });

  pipelineCommands.addStep({ recordHistory: false });
  pipelineApply.applyNow();
  if (renderSystem && !renderSystem.isRunning()) {
    renderSystem.start();
  }

  scheduleConnectionDraw();
});
