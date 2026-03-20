import {
  createConnectionDrawScheduler,
  renderConnectionLayer,
} from './connection-renderer.ts';
import {
  createPipelineCommandController,
} from './features/pipeline/pipeline-command-controller.ts';
import {
  createPipelineHistoryController,
} from './features/pipeline/pipeline-history.ts';
import {
  createPipelineHistoryActionsController,
} from './features/pipeline/pipeline-history-actions.ts';
import {
  applyLoadedPipelineState,
} from './features/pipeline/main-pipeline-load-apply.ts';
import {
  createPipelineHeaderActionController,
} from './features/pipeline/pipeline-header-actions-controller.ts';
import { setupMainPipelineIoSystem } from './features/pipeline/main-pipeline-io-setup.ts';
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
import { createMainStepRenderingController } from './features/step/main-step-rendering-controller.ts';
import { StepPreviewRenderer } from './features/step/step-preview-renderer.ts';
import {
  createStepPreviewDebugController,
} from './features/step/step-preview-debug-controller.ts';
import { createStepPreviewSystem } from './features/step/step-preview-system.ts';
import {
  syncHeaderActionAutoApplyState,
  syncHeaderActionHistoryState,
} from './shared/components/solid-header-actions.tsx';
import {
  syncPreviewShapeBarState,
  syncPreviewWireframeState,
} from './shared/components/solid-preview-shape-bar.tsx';
import {
  syncShaderDialogState,
} from './shared/components/solid-shader-dialog.tsx';
import {
  syncStatusLogState,
} from './shared/components/solid-status.tsx';
import {
  getLanguage,
  subscribeLanguageChange,
  t,
} from './shared/i18n.ts';
import { syncMainStaticLocaleText } from './shared/i18n/main-static-locale-text.ts';
import { setupStaticLocaleSync } from './shared/i18n/static-locale-sync.ts';
import {
  createSocketDropTargetResolver,
} from './shared/interactions/socket-dnd.ts';
import {
  type PipelineApplyController,
} from './features/pipeline/pipeline-apply.ts';
import {
  type PipelineDropIndicatorController,
} from './features/pipeline/pipeline-drop-indicators.ts';
import {
  createPipelineSocketDndController,
  type PipelineSocketDndController,
} from './features/pipeline/pipeline-socket-dnd-controller.ts';
import { Renderer } from './shared/rendering/renderer.ts';
import {
  clearSocketDragState,
  getLutReorderDragState,
  getSocketDragState,
  getSocketDropTargetState,
  getStepReorderDragState,
  setSocketDragState,
  setSocketDropTargetState,
  setSuppressClickUntil,
} from './shared/ui/interaction-state.ts';
import { resolveMainDomElements } from './shared/ui/main-dom-elements.ts';
import { bootstrapMainPostRuntime } from './shared/ui/main-post-runtime-bootstrap.ts';
import { type MainRenderPipeline } from './shared/ui/main-render-pipeline-setup.ts';
import { bootstrapMainRuntime } from './shared/ui/main-runtime-bootstrap.ts';
import {
  type PreviewShapeController,
} from './shared/ui/preview-shape-controller.ts';
import {
  getLightSettings,
  getMaterialSettings,
} from './shared/ui/scene-state.ts';
import {
  isAutoApplyEnabled,
  isPreviewWireframeOverlayEnabled,
  setAutoApplyEnabled,
  setPreviewWireframeOverlayEnabled,
} from './shared/ui/ui-state.ts';
import {
  type MainPreviewCaptureController,
} from './shared/ui/main-preview-capture-controller.ts';

const PIPELINE_HISTORY_LIMIT = 100;

const parseStepId = pipelineModel.parseStepId;
const parseLutId = pipelineModel.parseLutId;
const isValidParamName = pipelineModel.isValidParamName;
const isValidSocketAxis = pipelineView.isValidSocketAxis;
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
let mainRenderPipeline: MainRenderPipeline | null = null;
let stepPreviewSystem: ReturnType<typeof createStepPreviewSystem> | null = null;
let pipelineIoSystem: ReturnType<typeof setupMainPipelineIoSystem> | null = null;
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
    mainStepRendering.renderSteps();
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

const mainStepRendering = createMainStepRenderingController({
  getStepListElement: () => stepListEl,
  getSteps: getPipelineSteps,
  getLuts: getPipelineLuts,
  getMaterialSettings,
  getLightSettings,
  getStepPreviewRenderer: () => stepPreviewRenderer,
  getStepPreviewSystem: () => stepPreviewSystem,
  onUpdateShaderCodePanel: () => {
    updateShaderCodePanel();
  },
  onScheduleConnectionDraw: () => {
    connectionDrawScheduler.schedule();
  },
  t,
});

function scheduleConnectionDraw(): void {
  connectionDrawScheduler.schedule();
}

const stepPreviewDebugController = createStepPreviewDebugController({
  getStepPreviewSystem: () => stepPreviewSystem,
  onUpdateStepSwatches: () => mainStepRendering.updateStepSwatches(),
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
  renderSteps: () => mainStepRendering.renderSteps(),
  scheduleApply: () => pipelineApply.scheduleApply(),
  onStepOpsChanged: () => {
    stepPreviewSystem?.bumpPipelineVersion();
    mainStepRendering.updateStepSwatches();
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
    applyLoadedPipelineState({
      loaded,
      replacePipelineState,
      clearHistory: pipelineHistoryActions.clearHistory,
      renderSteps: () => mainStepRendering.renderSteps(),
      cancelPendingApply: () => pipelineApply.cancelPending(),
      applyNow: () => pipelineApply.applyNow(),
      onStatus: showStatus,
      t,
    });
  },
  getPipelineIoSystem: () => pipelineIoSystem,
  setAutoApplyEnabled,
  syncAutoApplyState: syncHeaderActionAutoApplyState,
  scheduleApply: () => pipelineApply.scheduleApply(),
  onStatus: showStatus,
  t,
});

window.addEventListener('DOMContentLoaded', () => {
  setupStaticLocaleSync({
    syncStaticLocaleText: () => {
      syncMainStaticLocaleText({
        getLanguage,
        t,
      });
    },
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

  const canvas = $<HTMLCanvasElement>('#gl-canvas');
  ({
    pipelineDropIndicators,
    renderer,
    pipelineApply,
    previewShapeController,
    stepPreviewRenderer,
    stepPreviewSystem,
    mainPreviewCapture,
    pipelineIoSystem,
    mainRenderPipeline,
  } = bootstrapMainRuntime({
    stepListEl,
    lutStripListEl,
    parseStepId,
    getStepReorderDragState,
    getLutReorderDragState,
    previewRuntime: {
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
    },
    stepPreviewDebugController,
    debugGlobalObject: window as unknown as Record<string, unknown>,
    getNextStepId: getPipelineNextStepId,
    onStatus: showStatus,
    t,
    lightGizmoElements: {
      layer: lightGizmoLayerEl,
      origin: lightGizmoOriginEl,
      tip: lightGizmoTipEl,
      label: lightGizmoLabelEl,
    },
    axisGizmoElements: {
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
    getCameraOrbit: () => ({
      orbitPitchDeg,
      orbitYawDeg,
      orbitDist,
    }),
    getLightDirectionWorld,
  }));

  bootstrapMainPostRuntime({
    select: $,
    canvas,
    paramNodeListEl,
    stepListEl,
    lutStripListEl,
    paramColumnEl,
    lightGizmoLayerEl,
    pipelineCommands,
    pipelineHistoryActions,
    pipelineHeaderActions,
    previewShapeController,
    mainPreviewCapture,
    pipelineDropIndicators,
    pipelineSocketDnd,
    pipelineApply,
    mainRenderPipeline,
    mainStepRendering,
    getShaderBuildInput,
    onUpdateShaderCodePanel: () => {
      updateShaderCodePanel();
    },
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
    onScheduleConnectionDraw: scheduleConnectionDraw,
    onStatus: showStatus,
    t,
  });
});
