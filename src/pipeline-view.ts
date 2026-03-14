import {
  LIGHT_RANGE_BINDINGS,
  MATERIAL_RANGE_BINDINGS,
  PARAM_GROUPS,
  colorToHex,
  getParamDef,
  getParamLabel,
  type LightSettings,
  type MaterialSettings,
} from './pipeline-model';
import { BLEND_MODES, BLEND_OPS, type LutModel, type ParamName, type StepModel } from './step-model';
import { getCustomChannelsForBlendMode } from './step-runtime';

export type SocketAxis = 'x' | 'y';

export type SocketDragState =
  | {
      mode: 'param';
      sourceEl: HTMLButtonElement;
      param: ParamName;
      pointerId: number;
      startX: number;
      startY: number;
      pointerX: number;
      pointerY: number;
      dragging: boolean;
    }
  | {
      mode: 'step';
      sourceEl: HTMLButtonElement;
      stepId: number;
      axis: SocketAxis;
      pointerId: number;
      startX: number;
      startY: number;
      pointerX: number;
      pointerY: number;
      dragging: boolean;
    };

export type SocketDropTarget =
  | {
      kind: 'param';
      element: HTMLButtonElement;
      param: ParamName;
    }
  | {
      kind: 'step';
      element: HTMLButtonElement;
      stepId: number;
      axis: SocketAxis;
    };

export interface StepReorderDragState {
  stepId: number;
  overStepId: number | null;
  dropAfter: boolean;
}

export interface LutReorderDragState {
  lutId: string;
  overLutId: string | null;
  dropAfter: boolean;
}

export interface ReorderIndicatorState<TId extends string | number> {
  draggedId: TId;
  overId: TId | null;
  dropAfter: boolean;
}

export interface ReorderIndicatorBinding<TId extends string | number> {
  containerEl: HTMLElement;
  itemSelector: string;
  getItemId: (item: HTMLElement) => TId | null;
  draggingClass: string;
  dropBeforeClass: string;
  dropAfterClass: string;
}

export interface ConnectionPathOptions {
  extraClass?: string;
  strokeColor?: string;
}

export interface ConnectionPathSpec {
  key: string;
  start: {
    x: number;
    y: number;
  };
  end: {
    x: number;
    y: number;
  };
  options?: ConnectionPathOptions;
}

interface AnchorPoint {
  x: number;
  y: number;
}

export const CONNECTION_FALLBACK_COLOR = '#78d9c4';
export const CONNECTION_DRAG_PREVIEW_COLOR = '#c6fff1';

function isValidQueryableRoot(root: ParentNode | null | undefined): root is ParentNode {
  return !!root && typeof root.querySelector === 'function';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function assertValidReorderIndicatorBinding<TId extends string | number>(
  binding: ReorderIndicatorBinding<TId>,
): void {
  if (!isHtmlElement(binding.containerEl)) {
    throw new Error('Reorder indicator containerEl must be an HTMLElement.');
  }
  if (!isNonEmptyString(binding.itemSelector)) {
    throw new Error('Reorder indicator itemSelector must be a non-empty string.');
  }
  if (typeof binding.getItemId !== 'function') {
    throw new Error('Reorder indicator getItemId must be a function.');
  }
  if (!isNonEmptyString(binding.draggingClass)) {
    throw new Error('Reorder indicator draggingClass must be a non-empty string.');
  }
  if (!isNonEmptyString(binding.dropBeforeClass)) {
    throw new Error('Reorder indicator dropBeforeClass must be a non-empty string.');
  }
  if (!isNonEmptyString(binding.dropAfterClass)) {
    throw new Error('Reorder indicator dropAfterClass must be a non-empty string.');
  }
}

function assertValidReorderIndicatorState<TId extends string | number>(
  state: ReorderIndicatorState<TId>,
): void {
  if (typeof state.dropAfter !== 'boolean') {
    throw new Error('Reorder indicator dropAfter must be a boolean.');
  }
}

function getItemElements<TId extends string | number>(binding: ReorderIndicatorBinding<TId>): HTMLElement[] {
  return Array.from(binding.containerEl.querySelectorAll<HTMLElement>(binding.itemSelector));
}

function findIndicatorItemById<TId extends string | number>(
  binding: ReorderIndicatorBinding<TId>,
  id: TId,
): HTMLElement | null {
  for (const item of getItemElements(binding)) {
    const itemId = binding.getItemId(item);
    if (
      itemId !== null
      && typeof itemId !== 'string'
      && typeof itemId !== 'number'
    ) {
      throw new Error(`Reorder indicator item id must be string|number|null: ${String(itemId)}`);
    }

    if (itemId === id) {
      return item;
    }
  }

  return null;
}

export function isValidSocketAxis(value: string): value is SocketAxis {
  return value === 'x' || value === 'y';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function syncMaterialPanel(materialSettings: MaterialSettings, root: ParentNode | null = document): void {
  if (!isValidQueryableRoot(root)) {
    return;
  }

  const baseColorInput = root.querySelector<HTMLInputElement>('#mat-base-color');
  const baseColorValue = root.querySelector<HTMLElement>('#mat-base-color-value');
  const ambientColorInput = root.querySelector<HTMLInputElement>('#mat-ambient-color');
  const ambientColorValue = root.querySelector<HTMLElement>('#mat-ambient-color-value');
  const hexColor = colorToHex(materialSettings.baseColor);
  const ambientHexColor = colorToHex(materialSettings.ambientColor);

  if (baseColorInput) baseColorInput.value = hexColor;
  if (baseColorValue) baseColorValue.textContent = hexColor;
  if (ambientColorInput) ambientColorInput.value = ambientHexColor;
  if (ambientColorValue) ambientColorValue.textContent = ambientHexColor;

  for (const binding of MATERIAL_RANGE_BINDINGS) {
    const input = root.querySelector<HTMLInputElement>(`#${binding.inputId}`);
    const output = root.querySelector<HTMLElement>(`#${binding.outputId}`);
    const currentValue = materialSettings[binding.key];

    if (input) input.value = String(currentValue);
    if (output) output.textContent = currentValue.toFixed(binding.fractionDigits);
  }
}

export function syncLightPanel(lightSettings: LightSettings, root: ParentNode | null = document): void {
  if (!isValidQueryableRoot(root)) {
    return;
  }

  for (const binding of LIGHT_RANGE_BINDINGS) {
    const input = root.querySelector<HTMLInputElement>(`#${binding.inputId}`);
    const output = root.querySelector<HTMLElement>(`#${binding.outputId}`);
    const currentValue = lightSettings[binding.key];

    if (input) input.value = String(Math.round(currentValue));
    if (output) output.textContent = `${currentValue.toFixed(binding.fractionDigits)}°`;
  }

  const toggleButton = root.querySelector<HTMLButtonElement>('#btn-toggle-light-gizmo');
  if (toggleButton) {
    toggleButton.textContent = `ガイド: ${lightSettings.showGizmo ? 'ON' : 'OFF'}`;
    toggleButton.setAttribute('aria-pressed', lightSettings.showGizmo ? 'true' : 'false');
  }
}

export function renderParamNodesMarkup(): string {
  return PARAM_GROUPS.map(group => {
    const nodes = group.params.map(paramName => {
      const param = getParamDef(paramName);
      return `
        <button type="button" class="param-node param-socket" data-param="${param.key}" title="${escapeHtml(param.label)} を接続">
          <span class="param-socket-dot" aria-hidden="true"></span>
          <span class="param-name">${escapeHtml(param.label)}</span>
          <span class="param-desc">${escapeHtml(param.description)}</span>
        </button>
      `;
    }).join('');

    const badge = group.tone === 'feedback'
      ? '<span class="param-group-badge">Prev Color</span>'
      : '';

    return `
      <section class="param-group param-group-${group.tone}" data-group="${group.key}">
        <header class="param-group-head">
          <div class="param-group-title-row">
            <div class="param-group-title">${escapeHtml(group.label)}</div>
            ${badge}
          </div>
          <div class="param-group-desc">${escapeHtml(group.description)}</div>
        </header>
        <div class="param-group-nodes">${nodes}</div>
      </section>
    `;
  }).join('');
}

function renderStepItemMarkup(step: StepModel, index: number, luts: LutModel[]): string {
  const lut = luts.find(item => item.id === step.lutId) ?? luts[0] ?? null;
  const lutOptions = luts.map(lutOpt => {
    const selected = lutOpt.id === step.lutId ? 'selected' : '';
    return `<option value="${lutOpt.id}" ${selected}>${escapeHtml(lutOpt.name)}</option>`;
  }).join('');

  const blendModeOptions = BLEND_MODES.map(mode => {
    const selected = mode.key === step.blendMode ? 'selected' : '';
    return `<option value="${mode.key}" ${selected}>${escapeHtml(mode.label)}</option>`;
  }).join('');

  const editableChannels = getCustomChannelsForBlendMode(step.blendMode);

  const opGrid = editableChannels.map(channel => {
    const options = BLEND_OPS.map(op => {
      const selected = step.ops[channel] === op ? 'selected' : '';
      return `<option value="${op}" ${selected}>${op}</option>`;
    }).join('');

    return `
      <label class="op-item">
        <span class="op-label">${channel.toUpperCase()}</span>
        <select class="step-op-select" data-step-id="${step.id}" data-channel="${channel}">
          ${options}
        </select>
      </label>
    `;
  }).join('');

  const opGridSection = editableChannels.length > 0
    ? `<div class="op-grid">${opGrid}</div>`
    : '';

  return `
    <article class="step-item" data-step-id="${step.id}">
      <section class="step-head">
        <div class="step-title-row">
          <button type="button" class="step-drag-handle" draggable="true" data-step-id="${step.id}" title="Stepをドラッグして移動">drag</button>
          <div class="step-title">Step ${index + 1}</div>
        </div>
        <button type="button" class="step-remove" data-step-id="${step.id}">削除</button>
      </section>

      <aside class="step-socket-rail">
        <button
          type="button"
          class="step-socket"
          data-step-id="${step.id}"
          data-axis="x"
          title="X: ${escapeHtml(getParamLabel(step.xParam))}"
        >
          <span class="step-socket-dot" aria-hidden="true"></span>
          <span class="step-socket-axis-label">X</span>
          <span class="step-socket-param">${escapeHtml(getParamLabel(step.xParam))}</span>
        </button>
        <button
          type="button"
          class="step-socket"
          data-step-id="${step.id}"
          data-axis="y"
          title="Y: ${escapeHtml(getParamLabel(step.yParam))}"
        >
          <span class="step-socket-dot" aria-hidden="true"></span>
          <span class="step-socket-axis-label">Y</span>
          <span class="step-socket-param">${escapeHtml(getParamLabel(step.yParam))}</span>
        </button>
      </aside>

      <section class="step-core">
        <div class="lut-row">
          <img class="lut-thumb" src="${lut ? lut.thumbUrl : ''}" alt="LUT thumbnail" />
          <select class="step-lut-select" data-step-id="${step.id}">
            ${lutOptions}
          </select>
        </div>

        <div class="step-mode-row">
          <label class="step-mode-field">
            <span class="op-label">Blend Mode</span>
            <select class="step-blend-mode-select" data-step-id="${step.id}">
              ${blendModeOptions}
            </select>
          </label>
        </div>

        ${opGridSection}
      </section>

      <aside class="step-preview">
        <canvas
          class="preview-swatch preview-sphere"
          data-step-id="${step.id}"
          data-preview="after"
          aria-label="Step ${index + 1} sphere preview"
        ></canvas>
      </aside>
    </article>
  `;
}

export function renderLutStripMarkup(luts: LutModel[], steps: StepModel[]): string {
  if (!Array.isArray(luts) || luts.length === 0) {
    return '<div class="lut-strip-empty">LUT がありません。LUT追加で読み込んでください。</div>';
  }

  return luts.map(lut => {
    const usageCount = Array.isArray(steps) ? steps.filter(step => step.lutId === lut.id).length : 0;
    return `
      <article class="lut-strip-item" draggable="true" data-lut-id="${lut.id}">
        <div class="lut-strip-thumb-wrap">
          <img class="lut-strip-thumb" src="${lut.thumbUrl}" alt="${escapeHtml(lut.name)} thumbnail" loading="lazy" />
        </div>
        <div class="lut-strip-meta">
          <div>
            <div class="lut-strip-name">${escapeHtml(lut.name)}</div>
            <div class="lut-strip-stats">${lut.width}x${lut.height} / 使用 ${usageCount} step</div>
          </div>
          <button
            type="button"
            class="lut-strip-remove"
            data-lut-id="${lut.id}"
            aria-label="${escapeHtml(lut.name)} を削除"
          >
            削除
          </button>
        </div>
      </article>
    `;
  }).join('');
}

export function renderStepListMarkup(steps: StepModel[], luts: LutModel[]): string {
  const addStepButtonHtml = `
    <div class="step-list-add-wrap">
      <button type="button" class="btn-secondary step-add-inline-btn">Step追加</button>
    </div>
  `;

  if (!Array.isArray(steps) || steps.length === 0) {
    return `
      <div class="step-core">Stepがありません。下のStep追加ボタンで作成できます。</div>
      ${addStepButtonHtml}
    `;
  }

  return `${steps.map((step, index) => renderStepItemMarkup(step, index, luts)).join('')}${addStepButtonHtml}`;
}

export function getParamSocketAnchorPoint(element: HTMLElement, workspaceRect: DOMRect): AnchorPoint {
  const anchor = element.querySelector<HTMLElement>('.param-socket-dot') ?? element;
  const rect = anchor.getBoundingClientRect();
  return {
    x: rect.left + rect.width * 0.5 - workspaceRect.left,
    y: rect.top + rect.height * 0.5 - workspaceRect.top,
  };
}

export function getStepSocketAnchorPoint(element: HTMLElement, workspaceRect: DOMRect): AnchorPoint {
  const anchor = element.querySelector<HTMLElement>('.step-socket-dot') ?? element;
  const rect = anchor.getBoundingClientRect();
  return {
    x: rect.left + rect.width * 0.5 - workspaceRect.left,
    y: rect.top + rect.height * 0.5 - workspaceRect.top,
  };
}

export function buildConnectionPath(startX: number, startY: number, endX: number, endY: number): string {
  const direction = endX >= startX ? 1 : -1;
  const curve = Math.max(36, Math.abs(endX - startX) * 0.48);
  const c1x = startX + curve * direction;
  const c2x = endX - curve * direction;
  return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`;
}

function isValidConnectionColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
    || /^hsl\(\s*(?:\d+(?:\.\d+)?)\s*,\s*(?:\d+(?:\.\d+)?)%\s*,\s*(?:\d+(?:\.\d+)?)%\s*\)$/.test(value);
}

function assertValidConnectionPathSpec(spec: ConnectionPathSpec, index: number): void {
  if (!spec || typeof spec !== 'object') {
    throw new Error(`ConnectionPathSpec at index ${index} must be an object.`);
  }
  if (!isNonEmptyString(spec.key)) {
    throw new Error(`ConnectionPathSpec key at index ${index} must be a non-empty string.`);
  }
  if (
    !Number.isFinite(spec.start.x)
    || !Number.isFinite(spec.start.y)
    || !Number.isFinite(spec.end.x)
    || !Number.isFinite(spec.end.y)
  ) {
    throw new Error(`ConnectionPathSpec coordinates at index ${index} must be finite numbers.`);
  }
  if (spec.options !== undefined && (spec.options === null || typeof spec.options !== 'object')) {
    throw new Error(`ConnectionPathSpec options at index ${index} must be an object when provided.`);
  }
}

function resolveConnectionClassName(extraClass: string | undefined): string {
  const normalizedExtraClass = typeof extraClass === 'string' ? extraClass.trim() : '';
  return normalizedExtraClass ? `connection-path ${normalizedExtraClass}` : 'connection-path';
}

function resolveConnectionStrokeColor(strokeColor: string | undefined): string {
  const rawStrokeColor = typeof strokeColor === 'string' ? strokeColor.trim() : '';
  return isValidConnectionColor(rawStrokeColor) ? rawStrokeColor : '';
}

function applyConnectionPathAttributes(
  path: SVGPathElement,
  start: AnchorPoint,
  end: AnchorPoint,
  options: ConnectionPathOptions = {},
): void {
  path.setAttribute('class', resolveConnectionClassName(options.extraClass));
  path.setAttribute('d', buildConnectionPath(start.x, start.y, end.x, end.y));

  const strokeColor = resolveConnectionStrokeColor(options.strokeColor);
  if (strokeColor) {
    path.style.setProperty('--connection-color', strokeColor);
  } else {
    path.style.removeProperty('--connection-color');
  }
}

export function getStepConnectionColor(stepId: number): string {
  if (!Number.isSafeInteger(stepId) || stepId <= 0) {
    return CONNECTION_FALLBACK_COLOR;
  }

  const normalizedSeed = stepId % 360;
  const hue = (normalizedSeed * 137.50776405003785 + 24) % 360;
  return `hsl(${hue.toFixed(1)}, 78%, 68%)`;
}

export function appendConnectionPath(
  connectionLayerEl: SVGSVGElement,
  start: AnchorPoint,
  end: AnchorPoint,
  options: ConnectionPathOptions = {},
): void {
  if (
    !(connectionLayerEl instanceof SVGSVGElement)
    || !Number.isFinite(start.x)
    || !Number.isFinite(start.y)
    || !Number.isFinite(end.x)
    || !Number.isFinite(end.y)
  ) {
    return;
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  applyConnectionPathAttributes(path, start, end, options);
  connectionLayerEl.appendChild(path);
}

export function syncConnectionPaths(connectionLayerEl: SVGSVGElement, specs: ConnectionPathSpec[]): void {
  if (!(connectionLayerEl instanceof SVGSVGElement)) {
    throw new Error('syncConnectionPaths connectionLayerEl must be an SVGSVGElement.');
  }
  if (!Array.isArray(specs)) {
    throw new Error('syncConnectionPaths specs must be an array.');
  }

  const keyedExistingPaths = new Map<string, SVGPathElement>();

  for (const path of Array.from(connectionLayerEl.querySelectorAll<SVGPathElement>('path.connection-path[data-connection-key]'))) {
    const key = path.dataset.connectionKey?.trim() ?? '';
    if (!isNonEmptyString(key)) {
      path.remove();
      continue;
    }

    if (keyedExistingPaths.has(key)) {
      path.remove();
      continue;
    }

    keyedExistingPaths.set(key, path);
  }

  for (const stalePath of Array.from(connectionLayerEl.querySelectorAll<SVGPathElement>('path.connection-path:not([data-connection-key])'))) {
    stalePath.remove();
  }

  for (let index = 0; index < specs.length; index++) {
    const spec = specs[index];
    assertValidConnectionPathSpec(spec, index);

    const key = spec.key.trim();
    let path = keyedExistingPaths.get(key);
    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    }

    path.dataset.connectionKey = key;
    applyConnectionPathAttributes(path, spec.start, spec.end, spec.options);
    connectionLayerEl.appendChild(path);
    keyedExistingPaths.delete(key);
  }

  for (const stalePath of keyedExistingPaths.values()) {
    stalePath.remove();
  }
}

export function clearReorderDropIndicators<TId extends string | number>(binding: ReorderIndicatorBinding<TId>): void {
  assertValidReorderIndicatorBinding(binding);
  const items = getItemElements(binding);
  items.forEach(item => {
    item.classList.remove(binding.draggingClass, binding.dropBeforeClass, binding.dropAfterClass);
  });
}

export function updateReorderDropIndicators<TId extends string | number>(
  binding: ReorderIndicatorBinding<TId>,
  state: ReorderIndicatorState<TId> | null,
): void {
  clearReorderDropIndicators(binding);
  if (!state) {
    return;
  }

  assertValidReorderIndicatorState(state);

  const draggingEl = findIndicatorItemById(binding, state.draggedId);
  draggingEl?.classList.add(binding.draggingClass);

  if (state.overId === null || state.overId === state.draggedId) {
    return;
  }

  const targetEl = findIndicatorItemById(binding, state.overId);
  if (!targetEl) {
    return;
  }

  targetEl.classList.add(state.dropAfter ? binding.dropAfterClass : binding.dropBeforeClass);
}

export function clearStepDropIndicators(stepListEl: HTMLElement): void {
  clearReorderDropIndicators<number>({
    containerEl: stepListEl,
    itemSelector: '.step-item',
    getItemId: item => {
      const rawStepId = item.dataset.stepId;
      if (!isNonEmptyString(rawStepId)) {
        return null;
      }

      const stepId = Number(rawStepId);
      if (!Number.isInteger(stepId) || stepId <= 0) {
        return null;
      }

      return stepId;
    },
    draggingClass: 'dragging-step',
    dropBeforeClass: 'step-drop-before',
    dropAfterClass: 'step-drop-after',
  });
}

export function updateStepDropIndicators(stepListEl: HTMLElement, stepReorderDragState: StepReorderDragState | null): void {
  updateReorderDropIndicators<number>(
    {
      containerEl: stepListEl,
      itemSelector: '.step-item',
      getItemId: item => {
        const rawStepId = item.dataset.stepId;
        if (!isNonEmptyString(rawStepId)) {
          return null;
        }

        const stepId = Number(rawStepId);
        if (!Number.isInteger(stepId) || stepId <= 0) {
          return null;
        }

        return stepId;
      },
      draggingClass: 'dragging-step',
      dropBeforeClass: 'step-drop-before',
      dropAfterClass: 'step-drop-after',
    },
    stepReorderDragState
      ? {
          draggedId: stepReorderDragState.stepId,
          overId: stepReorderDragState.overStepId,
          dropAfter: stepReorderDragState.dropAfter,
        }
      : null,
  );
}

export function clearLutDropIndicators(lutStripListEl: HTMLElement): void {
  clearReorderDropIndicators<string>({
    containerEl: lutStripListEl,
    itemSelector: '.lut-strip-item',
    getItemId: item => {
      const lutId = item.dataset.lutId;
      return isNonEmptyString(lutId) ? lutId : null;
    },
    draggingClass: 'dragging-lut',
    dropBeforeClass: 'lut-drop-before',
    dropAfterClass: 'lut-drop-after',
  });
}

export function updateLutDropIndicators(lutStripListEl: HTMLElement, lutReorderDragState: LutReorderDragState | null): void {
  updateReorderDropIndicators<string>(
    {
      containerEl: lutStripListEl,
      itemSelector: '.lut-strip-item',
      getItemId: item => {
        const lutId = item.dataset.lutId;
        return isNonEmptyString(lutId) ? lutId : null;
      },
      draggingClass: 'dragging-lut',
      dropBeforeClass: 'lut-drop-before',
      dropAfterClass: 'lut-drop-after',
    },
    lutReorderDragState
      ? {
          draggedId: lutReorderDragState.lutId,
          overId: lutReorderDragState.overLutId,
          dropAfter: lutReorderDragState.dropAfter,
        }
      : null,
  );
}