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
  type PipelineStateSnapshot,
} from './features/pipeline/pipeline-state.ts';
import * as pipelineView from './features/pipeline/pipeline-view.ts';
import * as shaderGenerator from './features/shader/shader-generator.ts';
import { CHANNELS, MAX_STEP_LABEL_LENGTH } from './features/step/step-model.ts';
import { StepPreviewRenderer } from './features/step/step-preview-renderer.ts';
import { createStepPreviewSystem } from './features/step/step-preview-system.ts';
import {
  type LutModel,
  type ParamName,
  type StepModel,
} from './features/step/types.ts';
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
  mountPreviewShapeBar,
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
  isPreviewWireframeOverlayEnabled,
  setAutoApplyEnabled,
  setPreviewWireframeOverlayEnabled,
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

interface PendingMainPreviewCapture {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface MainPreviewCaptureRequestOptions {
  hideLightGuide?: boolean;
}

interface AddStepOptions {
  recordHistory?: boolean;
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
let pendingMainPreviewCapture: PendingMainPreviewCapture | null = null;
let suppressLightGuideForMainPreviewCapture = false;
const pipelineUndoStack: PipelineStateSnapshot[] = [];
const pipelineRedoStack: PipelineStateSnapshot[] = [];

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

function isPipelineStateSnapshot(value: unknown): value is PipelineStateSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<PipelineStateSnapshot>;
  return Array.isArray(candidate.steps)
    && Array.isArray(candidate.luts)
    && typeof candidate.nextStepId === 'number'
    && Number.isInteger(candidate.nextStepId)
    && candidate.nextStepId > 0;
}

function cloneStepForHistory(step: StepModel): StepModel {
  if (!step || typeof step !== 'object') {
    throw new Error('履歴用Stepデータが不正です。');
  }

  return {
    ...step,
    ops: { ...step.ops },
  };
}

function cloneLutForHistory(lut: LutModel): LutModel {
  if (!lut || typeof lut !== 'object') {
    throw new Error('履歴用LUTデータが不正です。');
  }

  return {
    ...lut,
  };
}

function clonePipelineSnapshot(snapshot: PipelineStateSnapshot): PipelineStateSnapshot {
  if (!isPipelineStateSnapshot(snapshot)) {
    throw new Error('履歴スナップショットが不正です。');
  }

  return {
    steps: snapshot.steps.map(step => cloneStepForHistory(step)),
    luts: snapshot.luts.map(lut => cloneLutForHistory(lut)),
    nextStepId: snapshot.nextStepId,
  };
}

function capturePipelineSnapshot(): PipelineStateSnapshot {
  return clonePipelineSnapshot({
    steps: getPipelineSteps(),
    luts: getPipelineLuts(),
    nextStepId: getPipelineNextStepId(),
  });
}

function areStepModelsEqual(left: StepModel, right: StepModel): boolean {
  if (left.id !== right.id) return false;
  if (left.lutId !== right.lutId) return false;
  if ((left.label ?? '') !== (right.label ?? '')) return false;
  if (left.muted !== right.muted) return false;
  if (left.blendMode !== right.blendMode) return false;
  if (left.xParam !== right.xParam) return false;
  if (left.yParam !== right.yParam) return false;

  for (const channel of CHANNELS) {
    if (left.ops[channel] !== right.ops[channel]) {
      return false;
    }
  }

  return true;
}

function areLutModelsEqual(left: LutModel, right: LutModel): boolean {
  return left.id === right.id
    && left.name === right.name
    && left.width === right.width
    && left.height === right.height
    && left.thumbUrl === right.thumbUrl;
}

function arePipelineSnapshotsEqual(left: PipelineStateSnapshot, right: PipelineStateSnapshot): boolean {
  if (left.nextStepId !== right.nextStepId) {
    return false;
  }

  if (left.steps.length !== right.steps.length || left.luts.length !== right.luts.length) {
    return false;
  }

  for (let index = 0; index < left.steps.length; index += 1) {
    if (!areStepModelsEqual(left.steps[index], right.steps[index])) {
      return false;
    }
  }

  for (let index = 0; index < left.luts.length; index += 1) {
    if (!areLutModelsEqual(left.luts[index], right.luts[index])) {
      return false;
    }
  }

  return true;
}

function trimHistoryStack(stack: PipelineStateSnapshot[]): void {
  while (stack.length > PIPELINE_HISTORY_LIMIT) {
    stack.shift();
  }
}

function syncPipelineHistoryButtons(): void {
  syncHeaderActionHistoryState(pipelineUndoStack.length > 0, pipelineRedoStack.length > 0);
}

function clearPipelineHistory(): void {
  pipelineUndoStack.length = 0;
  pipelineRedoStack.length = 0;
  syncPipelineHistoryButtons();
}

function commitPipelineHistorySnapshot(before: PipelineStateSnapshot): boolean {
  if (!isPipelineStateSnapshot(before)) {
    throw new Error('履歴記録前のパイプライン状態が不正です。');
  }

  const after = capturePipelineSnapshot();
  if (arePipelineSnapshotsEqual(before, after)) {
    return false;
  }

  const lastUndo = pipelineUndoStack[pipelineUndoStack.length - 1];
  if (!lastUndo || !arePipelineSnapshotsEqual(lastUndo, before)) {
    pipelineUndoStack.push(clonePipelineSnapshot(before));
    trimHistoryStack(pipelineUndoStack);
  }

  pipelineRedoStack.length = 0;
  syncPipelineHistoryButtons();
  return true;
}

function restorePipelineSnapshot(snapshot: PipelineStateSnapshot): void {
  if (!isPipelineStateSnapshot(snapshot)) {
    throw new Error('復元対象のパイプライン状態が不正です。');
  }

  replacePipelineState(clonePipelineSnapshot(snapshot));
  renderSteps();
  scheduleApply();
}

function undoPipeline(): boolean {
  const previous = pipelineUndoStack.pop();
  if (!previous) {
    showStatus(t('main.status.undoUnavailable'), 'info');
    syncPipelineHistoryButtons();
    return false;
  }

  const current = capturePipelineSnapshot();
  pipelineRedoStack.push(current);
  trimHistoryStack(pipelineRedoStack);

  restorePipelineSnapshot(previous);
  syncPipelineHistoryButtons();
  showStatus(t('main.status.undoApplied'), 'info');
  return true;
}

function redoPipeline(): boolean {
  const next = pipelineRedoStack.pop();
  if (!next) {
    showStatus(t('main.status.redoUnavailable'), 'info');
    syncPipelineHistoryButtons();
    return false;
  }

  const current = capturePipelineSnapshot();
  pipelineUndoStack.push(current);
  trimHistoryStack(pipelineUndoStack);

  restorePipelineSnapshot(next);
  syncPipelineHistoryButtons();
  showStatus(t('main.status.redoApplied'), 'info');
  return true;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return target.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]') !== null;
}

function handleHistoryShortcutKeydown(event: KeyboardEvent): void {
  if (!(event instanceof KeyboardEvent)) {
    return;
  }

  if (event.defaultPrevented) {
    return;
  }

  if (isEditableEventTarget(event.target)) {
    return;
  }

  const hasModifier = event.ctrlKey || event.metaKey;
  if (!hasModifier || event.altKey) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      redoPipeline();
      return;
    }

    undoPipeline();
    return;
  }

  if (key === 'y' && !event.shiftKey) {
    event.preventDefault();
    redoPipeline();
  }
}

function parseAddStepOptions(options: AddStepOptions | undefined): { recordHistory: boolean } {
  if (options === undefined) {
    return { recordHistory: true };
  }

  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('addStep オプションが不正です。');
  }

  if (options.recordHistory !== undefined && typeof options.recordHistory !== 'boolean') {
    throw new Error(`addStep.recordHistory は boolean で指定してください: ${String(options.recordHistory)}`);
  }

  return {
    recordHistory: options.recordHistory ?? true,
  };
}

function formatDatePart(value: number, digits: number): string {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error('日付情報が不正です。');
  }
  return String(value).padStart(digits, '0');
}

function buildPreviewDownloadFilename(kind: 'main' | 'step', now: Date = new Date()): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('保存時刻の取得に失敗しました。');
  }

  const yyyy = formatDatePart(now.getFullYear(), 4);
  const mm = formatDatePart(now.getMonth() + 1, 2);
  const dd = formatDatePart(now.getDate(), 2);
  const hh = formatDatePart(now.getHours(), 2);
  const min = formatDatePart(now.getMinutes(), 2);
  const ss = formatDatePart(now.getSeconds(), 2);
  const suffix = kind === 'main' ? '3d-preview' : 'step-preview';
  return `lutchainer-preview-${suffix}-${yyyy}${mm}${dd}-${hh}${min}${ss}.png`;
}

function downloadBlobAsFile(blob: Blob, filename: string): void {
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error('ダウンロード対象のBlobが不正です。');
  }
  if (typeof filename !== 'string' || filename.trim().length === 0) {
    throw new Error('ダウンロードファイル名が不正です。');
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  if (!(canvas instanceof HTMLCanvasElement)) {
    return Promise.reject(new Error('キャンバス要素が不正です。'));
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('PNGの生成に失敗しました。'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function copyCanvasSnapshot(canvas: HTMLCanvasElement): HTMLCanvasElement {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('スナップショット元キャンバスが不正です。');
  }
  if (!Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width <= 0 || canvas.height <= 0) {
    throw new Error('スナップショット元キャンバスのサイズが不正です。');
  }

  const snapshot = document.createElement('canvas');
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;

  const ctx = snapshot.getContext('2d');
  if (!ctx) {
    throw new Error('スナップショット用Canvasの作成に失敗しました。');
  }

  ctx.drawImage(canvas, 0, 0);
  return snapshot;
}

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
  clearPipelineHistory();
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

function normalizeStepLabelInput(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('Stepラベルは文字列で指定してください。');
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return pipelineModel.parseNonEmptyText(trimmed, 'step.label', MAX_STEP_LABEL_LENGTH);
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

function addStep(options?: AddStepOptions): void {
  let parsedOptions: { recordHistory: boolean };
  try {
    parsedOptions = parseAddStepOptions(options);
  } catch (error) {
    showStatus(pipelineModel.toErrorMessage(error), 'error');
    return;
  }

  const before = parsedOptions.recordHistory ? capturePipelineSnapshot() : null;
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
  if (before) {
    commitPipelineHistorySnapshot(before);
  }
  renderSteps();
  scheduleApply();
}

function duplicateStep(stepId: number): void {
  const before = capturePipelineSnapshot();
  const result = pipelineModel.duplicatePipelineStep(getPipelineSteps(), stepId, getPipelineNextStepId());
  if (result.error || !result.duplicated) {
    showStatus(result.error ?? t('common.unknownError'), 'error');
    return;
  }

  setPipelineSteps(result.steps);
  setPipelineNextStepId(result.nextStepId);
  commitPipelineHistorySnapshot(before);
  renderSteps();
  scheduleApply();
  showStatus(t('main.status.stepDuplicated', { stepId: result.duplicated.id }), 'info');
}

function setStepMuted(stepId: number, muted: unknown): void {
  if (typeof muted !== 'boolean') {
    showStatus(t('main.status.stepMuteInvalidValue', { value: String(muted) }), 'error');
    return;
  }

  const step = getStepById(stepId);
  if (!step) {
    return;
  }

  if (step.muted === muted) {
    return;
  }

  const before = capturePipelineSnapshot();
  step.muted = muted;
  commitPipelineHistorySnapshot(before);
  renderSteps();
  scheduleApply();
}

function setStepLabel(stepId: number, label: unknown): void {
  const step = getStepById(stepId);
  if (!step) {
    return;
  }

  let normalized: string | null;
  try {
    normalized = normalizeStepLabelInput(label);
  } catch (error) {
    showStatus(pipelineModel.toErrorMessage(error), 'error');
    return;
  }

  const nextLabel = normalized ?? undefined;
  if (step.label === nextLabel) {
    return;
  }

  const before = capturePipelineSnapshot();
  step.label = nextLabel;
  commitPipelineHistorySnapshot(before);
  renderSteps();
}

function setStepLut(stepId: number, lutId: unknown): void {
  if (typeof lutId !== 'string') {
    showStatus(t('pipeline.status.selectedLutIdInvalid'), 'error');
    return;
  }

  const validatedLutId = parseLutId(lutId);
  if (!validatedLutId) {
    showStatus(t('pipeline.status.selectedLutIdInvalid'), 'error');
    return;
  }

  const lutExists = getPipelineLuts().some(lut => lut.id === validatedLutId);
  if (!lutExists) {
    showStatus(t('pipeline.status.selectedLutMissing'), 'error');
    return;
  }

  const step = getStepById(stepId);
  if (!step) {
    return;
  }

  if (step.lutId === validatedLutId) {
    return;
  }

  const before = capturePipelineSnapshot();
  step.lutId = validatedLutId;
  commitPipelineHistorySnapshot(before);
  renderSteps();
  scheduleApply();
}

function setStepBlendMode(stepId: number, blendMode: unknown): void {
  if (typeof blendMode !== 'string' || !pipelineModel.isValidBlendMode(blendMode)) {
    showStatus(t('pipeline.status.invalidBlendMode', { blendMode: String(blendMode) }), 'error');
    return;
  }

  const step = getStepById(stepId);
  if (!step) {
    return;
  }

  if (step.blendMode === blendMode) {
    return;
  }

  const before = capturePipelineSnapshot();
  step.blendMode = blendMode;
  commitPipelineHistorySnapshot(before);
  renderSteps();
  scheduleApply();
}

function setStepChannelOp(stepId: number, channel: unknown, op: unknown): void {
  if (typeof channel !== 'string' || !pipelineModel.isValidChannelName(channel)) {
    showStatus(t('pipeline.status.invalidOp', { op: String(op) }), 'error');
    return;
  }

  if (typeof op !== 'string' || !pipelineModel.isValidBlendOp(op)) {
    showStatus(t('pipeline.status.invalidOp', { op: String(op) }), 'error');
    return;
  }

  const step = getStepById(stepId);
  if (!step) {
    return;
  }

  if (step.ops[channel] === op) {
    return;
  }

  const before = capturePipelineSnapshot();
  step.ops[channel] = op;
  commitPipelineHistorySnapshot(before);
  stepPreviewSystem?.bumpPipelineVersion();
  updateStepSwatches();
  updateShaderCodePanel();
  scheduleApply();
}

function removeStep(stepId: number): void {
  const before = capturePipelineSnapshot();
  const result = pipelineModel.removeStepFromPipeline(getPipelineSteps(), stepId);
  if (!result.removed) {
    showStatus(t('main.status.removeStepNotFound', { stepId }), 'error');
    return;
  }
  setPipelineSteps(result.steps);
  commitPipelineHistorySnapshot(before);
  renderSteps();
  scheduleApply();
}

function removeLut(lutId: string): void {
  const before = capturePipelineSnapshot();
  const result = pipelineModel.removeLutFromPipeline(getPipelineLuts(), getPipelineSteps(), lutId);
  if (result.error) {
    showStatus(result.error, 'error');
    return;
  }

  setPipelineLuts(result.luts);
  setPipelineSteps(result.steps);
  commitPipelineHistorySnapshot(before);
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
  if (!isValidSocketAxis(axis)) {
    return false;
  }

  if (!isValidParamName(param)) {
    return false;
  }

  const step = getStepById(stepId);
  if (!step) return false;

  const currentParam = axis === 'x' ? step.xParam : step.yParam;
  if (currentParam === param) {
    return false;
  }

  const before = capturePipelineSnapshot();
  if (axis === 'x') step.xParam = param;
  else step.yParam = param;

  commitPipelineHistorySnapshot(before);
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
  const before = capturePipelineSnapshot();
  const steps = getPipelineSteps();
  const draggedExists = steps.some(step => step.id === stepId);
  if (!draggedExists) {
    showStatus(t('main.status.moveStepNotFound', { stepId }), 'error');
    return;
  }

  const nextSteps = reorderItemsById(steps, stepId, targetStepId, after, step => step.id);
  if (!nextSteps) return;

  setPipelineSteps(nextSteps);
  commitPipelineHistorySnapshot(before);
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
  const before = capturePipelineSnapshot();
  const luts = getPipelineLuts();
  const draggedExists = luts.some(lut => lut.id === lutId);
  if (!draggedExists) {
    showStatus(t('main.status.moveLutNotFound'), 'error');
    return;
  }

  const nextLuts = reorderItemsById(luts, lutId, targetLutId, after, lut => lut.id);
  if (!nextLuts) return;

  setPipelineLuts(nextLuts);
  commitPipelineHistorySnapshot(before);
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
    initialCanUndo: pipelineUndoStack.length > 0,
    initialCanRedo: pipelineRedoStack.length > 0,
    onUndoPipeline: () => {
      undoPipeline();
    },
    onRedoPipeline: () => {
      redoPipeline();
    },
    onResetPipeline: () => {
      replacePipelineState({
        luts: getPipelineLuts(),
        steps: [],
        nextStepId: 1,
      });
      clearPipelineHistory();
      addStep({ recordHistory: false });
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
    initialWireframeEnabled: isPreviewWireframeOverlayEnabled(),
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
  window.addEventListener('keydown', handleHistoryShortcutKeydown);
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
  renderer.setWireframeOverlayEnabled(isPreviewWireframeOverlayEnabled());
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
  clearPipelineHistory();

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
    onDuplicateStep: stepId => {
      duplicateStep(stepId);
    },
    onRemoveStep: stepId => {
      removeStep(stepId);
    },
    onStepMuteChange: (stepId, muted) => {
      setStepMuted(stepId, muted);
    },
    onStepLabelChange: (stepId, label) => {
      setStepLabel(stepId, label);
    },
    onStepLutChange: (stepId, lutId) => {
      setStepLut(stepId, lutId);
    },
    onStepBlendModeChange: (stepId, blendMode) => {
      setStepBlendMode(stepId, blendMode);
    },
    onStepOpChange: (stepId, channel, op) => {
      setStepChannelOp(stepId, channel, op);
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
      const before = capturePipelineSnapshot();

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
      commitPipelineHistorySnapshot(before);
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

  addStep({ recordHistory: false });
  applyPipelineNow();
  if (renderSystem && !renderSystem.isRunning()) {
    renderSystem.start();
  }

  scheduleConnectionDraw();
});
