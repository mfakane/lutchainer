import {
  applyLoadedPipelineState,
} from '../../features/pipeline/main-pipeline-load-apply.ts';
import {
  createPipelineCommandController,
} from '../../features/pipeline/pipeline-command-controller.ts';
import {
  createPipelineHistoryActionsController,
} from '../../features/pipeline/pipeline-history-actions.ts';
import {
  createPipelineHistoryController,
} from '../../features/pipeline/pipeline-history.ts';
import * as pipelineModel from '../../features/pipeline/pipeline-model.ts';
import {
  getCustomParams as getPipelineCustomParams,
  getLuts as getPipelineLuts,
  getSteps as getPipelineSteps,
  replacePipelineState,
  setCustomParams as setPipelineCustomParams,
  setLuts as setPipelineLuts,
  setSteps as setPipelineSteps,
} from '../../features/pipeline/pipeline-state.ts';
import * as pipelineView from '../../features/pipeline/pipeline-view.ts';
import {
  createShaderExportSystem,
} from '../../features/shader/shader-export-system.ts';
import { MAX_STEP_LABEL_LENGTH } from '../../features/step/step-model.ts';
import {
  createStepPreviewDebugController,
} from '../../features/step/step-preview-debug-controller.ts';
import {
  createBrowserPipelineImageAdapter,
} from '../../platforms/browser/pipeline-image-adapter.ts';
import {
  downloadBlobAsFile,
} from '../../platforms/browser/preview-export.ts';
import type { StepPreviewRenderer } from '../../platforms/webgl/step-preview-renderer.ts';
import {
  syncHeaderActionAutoApplyState,
  syncHeaderActionHistoryState,
} from './components/solid-header-actions.tsx';
import {
  syncPreviewShapeBarState,
  syncPreviewWireframeState,
} from './components/solid-preview-shape-bar.tsx';
import {
  getLanguage,
  subscribeLanguageChange,
  t,
} from './i18n.ts';
import { syncMainStaticLocaleText } from './i18n/main-static-locale-text.ts';
import { setupStaticLocaleSync } from './i18n/static-locale-sync.ts';
import {
  createSocketDropTargetResolver,
} from './interactions/socket-dnd.ts';
import { setupMainPipelineIoSystem } from './pipeline/main-pipeline-io-setup.ts';
import { setupMainPipelineSocketDnd } from './pipeline/main-pipeline-socket-dnd-setup.ts';
import {
  type PipelineApplyController,
} from './pipeline/pipeline-apply.ts';
import {
  type PipelineDropIndicatorController,
} from './pipeline/pipeline-drop-indicators.ts';
import {
  createPipelineFileDropController,
} from './pipeline/pipeline-file-drop-controller.ts';
import {
  createPipelineHeaderActionController,
} from './pipeline/pipeline-header-actions-controller.ts';
import {
  type PipelineSocketDndController,
} from './pipeline/pipeline-socket-dnd-controller.ts';
import { createMainStepRenderingController } from './step/main-step-rendering-controller.ts';
import { createStepPreviewSystem } from './step/step-preview-system.ts';
import './styles/app-theme.css.ts';
import './styles/app-shell.css.ts';
import {
  clearSocketDragState,
  getLutReorderDragState,
  getSocketDragState,
  getSocketDropTargetState,
  getStepReorderDragState,
  setSocketDragState,
  setSocketDropTargetState,
  setSuppressClickUntil,
} from './ui/interaction-state.ts';
import { setupMainConnectionDrawController } from './ui/main-connection-draw-controller.ts';
import { resolveMainDomElements } from './ui/main-dom-elements.ts';
import { createRequiredDomSelector } from './ui/main-dom-select.ts';
import { createMainOrbitStateController } from './ui/main-orbit-state.ts';
import { bootstrapMainPostRuntime } from './ui/main-post-runtime-bootstrap.ts';
import {
  type MainPreviewCaptureController,
} from './ui/main-preview-capture-controller.ts';
import { createMainPreviewDebugController } from './ui/main-preview-debug-controller.ts';
import { type MainRenderPipeline } from './ui/main-render-pipeline-setup.ts';
import { bootstrapMainRuntime } from './ui/main-runtime-bootstrap.ts';
import {
  createLightDirectionWorldGetter,
  createShaderBuildInputGetter,
  createShaderCodePanelUpdater,
  createShaderExportHandler,
  createStatusReporter,
} from './ui/main-shader-status-helpers.ts';
import type { PipelinePresetKey } from './ui/pipeline-presets.ts';
import {
  type PreviewShapeController,
} from './ui/preview-shape-controller.ts';
import {
  getLightSettings,
  getMaterialSettings,
  setLightSettings,
  setMaterialSettings,
} from './ui/scene-state.ts';
import {
  isAutoApplyEnabled,
  isPreviewWireframeOverlayEnabled,
  setAutoApplyEnabled,
  setPreviewWireframeOverlayEnabled,
} from './ui/ui-state.ts';

declare const __BUILD_COMMIT_ID__: string;

const PIPELINE_HISTORY_LIMIT = 100;

pipelineModel.configurePipelineImageAdapter(createBrowserPipelineImageAdapter());

const parseStepId = pipelineModel.parseStepId;
const parseLutId = pipelineModel.parseLutId;
const isValidParamName = pipelineModel.isValidParamName;
const isValidSocketAxis = pipelineView.isValidSocketAxis;
const resolveSocketDropTargetForDrag = createSocketDropTargetResolver({
  parseStepId,
  isValidSocketAxis,
  isValidParamName,
});

let pipelineApply: PipelineApplyController;
let pipelineDropIndicators: PipelineDropIndicatorController;
let pipelineSocketDnd: PipelineSocketDndController;
let previewShapeController: PreviewShapeController;
let stepPreviewRenderer: StepPreviewRenderer | null = null;
let shaderExportSystem: ReturnType<typeof createShaderExportSystem> | null = null;

const selectRequired = createRequiredDomSelector();
const orbitStateController = createMainOrbitStateController({
  initialState: {
    orbitPitchDeg: 25.0,
    orbitYawDeg: 45.0,
    orbitDist: 2.8,
  },
});

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
let mainPreviewDebugController: ReturnType<typeof createMainPreviewDebugController> | null = null;
let pipelineFileDropOverlayEl: HTMLElement;

const connectionDrawController = setupMainConnectionDrawController({
  getPipelineWorkspaceEl: () => pipelineWorkspaceEl,
  getConnectionLayerEl: () => connectionLayerEl,
  getSteps: getPipelineSteps,
  getSocketDragState,
  getSocketDropTarget: getSocketDropTargetState,
});

const scheduleConnectionDraw = (): void => {
  connectionDrawController.scheduleConnectionDraw();
};

const pipelineHistory = createPipelineHistoryController({
  historyLimit: PIPELINE_HISTORY_LIMIT,
  captureSnapshot: () => ({
    steps: getPipelineSteps(),
    luts: getPipelineLuts(),
    customParams: getPipelineCustomParams(),
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

const getLightDirectionWorld = createLightDirectionWorldGetter({
  getLightSettings,
});

const getShaderBuildInput = createShaderBuildInputGetter({
  getSteps: getPipelineSteps,
  getLuts: getPipelineLuts,
  getCustomParams: getPipelineCustomParams,
  getMaterialSettings,
});

const updateShaderCodePanel = createShaderCodePanelUpdater({
  getShaderBuildInput,
});

const showStatus = createStatusReporter();

const exportShaderZip = createShaderExportHandler({
  getShaderExportSystem: () => shaderExportSystem,
  onStatus: showStatus,
  t,
});

function syncHeaderBuildCommit(): void {
  const buildCommitEl = document.querySelector<HTMLElement>('#header-build-commit');
  if (!buildCommitEl) {
    return;
  }

  if (typeof __BUILD_COMMIT_ID__ !== 'string' || __BUILD_COMMIT_ID__.trim().length === 0) {
    buildCommitEl.textContent = '';
    buildCommitEl.hidden = true;
    return;
  }

  buildCommitEl.textContent = __BUILD_COMMIT_ID__.trim();
  buildCommitEl.hidden = false;
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
  getCustomParams: getPipelineCustomParams,
  getMaterialSettings,
  getLightSettings,
  getStepPreviewRenderer: () => stepPreviewRenderer,
  getStepPreviewSystem: () => stepPreviewSystem,
  onUpdateShaderCodePanel: () => {
    updateShaderCodePanel();
  },
  onScheduleConnectionDraw: scheduleConnectionDraw,
  t,
});

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
  getCustomParams: getPipelineCustomParams,
  setCustomParams: setPipelineCustomParams,
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

pipelineSocketDnd = setupMainPipelineSocketDnd({
  getSocketDragState,
  setSocketDragState,
  clearSocketDragState,
  getSocketDropTargetState,
  setSocketDropTargetState,
  resolveDropTarget: resolveSocketDropTargetForDrag,
  assignParamToSocket: pipelineCommands.assignParamToSocket,
  scheduleConnectionDraw,
  setSuppressClickUntil,
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
      luts: pipelineModel.createBuiltinLuts(),
      steps: [],
      customParams: [],
    });
    pipelineHistoryActions.clearHistory();
    mainStepRendering.renderSteps();
    pipelineApply.cancelPending();
    pipelineApply.applyNow();
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
  syncHeaderBuildCommit();

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
  } = resolveMainDomElements({ select: selectRequired }));
  pipelineFileDropOverlayEl = selectRequired<HTMLElement>('#pipeline-file-drop-overlay');

  const canvas = selectRequired<HTMLCanvasElement>('#gl-canvas');
  ({
    pipelineDropIndicators,
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
      getCustomParams: getPipelineCustomParams,
      getMaterialSettings,
      getLightSettings,
      stepPreviewLightDirection: pipelineModel.STEP_PREVIEW_LIGHT_DIR,
      stepPreviewViewDirection: pipelineModel.STEP_PREVIEW_VIEW_DIR,
    },
    stepPreviewDebugController,
    debugGlobalObject: window as unknown as Record<string, unknown>,
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
    getCameraOrbit: orbitStateController.getOrbitState,
    getLightDirectionWorld,
  }));

  mainPreviewDebugController = createMainPreviewDebugController({
    canvas,
    getOrbitState: orbitStateController.getOrbitState,
    setOrbitState: orbitStateController.setOrbitState,
    getMaterialSettings,
    setMaterialSettings,
    getLightSettings,
    setLightSettings,
    loadPreset: async (preset: string) => {
      await pipelineHeaderActions.buildMountOptions().onResetPresetSelected(
        preset as PipelinePresetKey,
      );
    },
  });
  mainPreviewDebugController.registerGlobalDebugApi({
    globalObject: window as unknown as Record<string, unknown>,
  });

  shaderExportSystem = createShaderExportSystem({
    getShaderBuildInput,
    onDownloadZip: (zipData, filename) => {
      const blob = new Blob(
        [(zipData.buffer as ArrayBuffer).slice(zipData.byteOffset, zipData.byteOffset + zipData.byteLength)],
        { type: 'application/zip' },
      );
      downloadBlobAsFile(blob, filename);
    },
    toErrorMessage: pipelineModel.toErrorMessage,
  });

  createPipelineFileDropController({
    overlayEl: pipelineFileDropOverlayEl,
    loadPipelineFile: pipelineHeaderActions.loadPipelineFile,
    isPipelineFile: pipelineModel.isZipLikeFile,
  });

  bootstrapMainPostRuntime({
    select: selectRequired,
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
    onExportShaderZip: exportShaderZip,
    onUpdateShaderCodePanel: updateShaderCodePanel,
    getOrbitState: orbitStateController.getOrbitState,
    setOrbitState: orbitStateController.setOrbitState,
    onScheduleConnectionDraw: scheduleConnectionDraw,
    onStatus: showStatus,
    t,
  });
});
