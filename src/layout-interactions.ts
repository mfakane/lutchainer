export type StatusKind = 'success' | 'error' | 'info';

export interface CameraOrbitState {
  orbitPitchDeg: number;
  orbitYawDeg: number;
  orbitDist: number;
}

interface SetupOrbitPointerControlsOptions {
  canvas: HTMLCanvasElement;
  getOrbitState: () => CameraOrbitState;
  setOrbitState: (nextState: CameraOrbitState) => void;
}

interface SetupPipelinePanelResizerOptions {
  panel: HTMLElement;
  resizer: HTMLElement;
  onResized?: () => void;
}

interface SetupPreviewPanelLayoutResizerOptions {
  previewPanel: HTMLElement;
  previewDisplay: HTMLElement;
  previewResizer: HTMLElement;
  onStatus?: (message: string, kind: StatusKind) => void;
}

const RAD_TO_DEG = 180 / Math.PI;
const ORBIT_PITCH_MIN_DEG = (-Math.PI / 2 + 0.05) * RAD_TO_DEG;
const ORBIT_PITCH_MAX_DEG = (Math.PI / 2 - 0.05) * RAD_TO_DEG;
const ORBIT_DISTANCE_MIN = 1.2;
const ORBIT_DISTANCE_MAX = 12.0;
const ORBIT_DRAG_SCALE_DEG = 0.007 * RAD_TO_DEG;
const ORBIT_WHEEL_SCALE = 0.005;
const ORBIT_TOUCH_PINCH_SCALE = 0.01;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
}

function assertHtmlElement(value: unknown, name: string): asserts value is HTMLElement {
  if (!(value instanceof HTMLElement)) {
    throw new Error(`${name} must be an HTMLElement.`);
  }
}

function assertHtmlCanvasElement(value: unknown, name: string): asserts value is HTMLCanvasElement {
  if (!(value instanceof HTMLCanvasElement)) {
    throw new Error(`${name} must be an HTMLCanvasElement.`);
  }
}

function normalizeOrbitState(value: unknown): CameraOrbitState {
  const source = value as Partial<CameraOrbitState> | null | undefined;
  const orbitPitchDeg = isFiniteNumber(source?.orbitPitchDeg) ? source.orbitPitchDeg : 0;
  const orbitYawDeg = isFiniteNumber(source?.orbitYawDeg) ? source.orbitYawDeg : 0;
  const orbitDist = isFiniteNumber(source?.orbitDist) ? source.orbitDist : 2.8;

  return {
    orbitPitchDeg: clamp(orbitPitchDeg, ORBIT_PITCH_MIN_DEG, ORBIT_PITCH_MAX_DEG),
    orbitYawDeg,
    orbitDist: clamp(orbitDist, ORBIT_DISTANCE_MIN, ORBIT_DISTANCE_MAX),
  };
}

function assertOrbitOptions(options: SetupOrbitPointerControlsOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('Orbit control options must be an object.');
  }

  assertHtmlCanvasElement(options.canvas, 'Orbit canvas');

  if (typeof options.getOrbitState !== 'function') {
    throw new Error('Orbit control getOrbitState must be a function.');
  }
  if (typeof options.setOrbitState !== 'function') {
    throw new Error('Orbit control setOrbitState must be a function.');
  }
}

function assertPanelResizerOptions(options: SetupPipelinePanelResizerOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('Panel resizer options must be an object.');
  }

  assertHtmlElement(options.panel, 'Panel element');
  assertHtmlElement(options.resizer, 'Panel resizer element');

  if (options.onResized !== undefined && typeof options.onResized !== 'function') {
    throw new Error('Panel resizer onResized must be a function when provided.');
  }
}

function assertPreviewResizerOptions(options: SetupPreviewPanelLayoutResizerOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('Preview resizer options must be an object.');
  }

  assertHtmlElement(options.previewPanel, 'Preview panel element');
  assertHtmlElement(options.previewDisplay, 'Preview display element');
  assertHtmlElement(options.previewResizer, 'Preview resizer element');

  if (options.onStatus !== undefined && typeof options.onStatus !== 'function') {
    throw new Error('Preview resizer onStatus must be a function when provided.');
  }
}

export function setupOrbitPointerControls(options: SetupOrbitPointerControlsOptions): void {
  assertOrbitOptions(options);

  const { canvas, getOrbitState, setOrbitState } = options;

  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let touchDist = 0;

  const updateOrbitByDelta = (dx: number, dy: number): void => {
    const current = normalizeOrbitState(getOrbitState());
    const next: CameraOrbitState = {
      orbitPitchDeg: clamp(current.orbitPitchDeg + dy * ORBIT_DRAG_SCALE_DEG, ORBIT_PITCH_MIN_DEG, ORBIT_PITCH_MAX_DEG),
      orbitYawDeg: current.orbitYawDeg + dx * ORBIT_DRAG_SCALE_DEG,
      orbitDist: current.orbitDist,
    };
    setOrbitState(next);
  };

  canvas.addEventListener('mousedown', event => {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    event.preventDefault();
  });

  window.addEventListener('mousemove', event => {
    if (!isDragging) return;

    const dx = event.clientX - lastMouseX;
    const dy = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    updateOrbitByDelta(-dx, dy);
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('wheel', event => {
    const current = normalizeOrbitState(getOrbitState());
    const next: CameraOrbitState = {
      orbitPitchDeg: current.orbitPitchDeg,
      orbitYawDeg: current.orbitYawDeg,
      orbitDist: clamp(current.orbitDist + event.deltaY * ORBIT_WHEEL_SCALE, ORBIT_DISTANCE_MIN, ORBIT_DISTANCE_MAX),
    };
    setOrbitState(next);
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchstart', event => {
    if (event.touches.length === 1) {
      isDragging = true;
      lastMouseX = event.touches[0].clientX;
      lastMouseY = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      touchDist = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
    }
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', event => {
    if (event.touches.length === 1 && isDragging) {
      const dx = event.touches[0].clientX - lastMouseX;
      const dy = event.touches[0].clientY - lastMouseY;
      lastMouseX = event.touches[0].clientX;
      lastMouseY = event.touches[0].clientY;
      updateOrbitByDelta(dx, dy);
    } else if (event.touches.length === 2) {
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
      const current = normalizeOrbitState(getOrbitState());
      const next: CameraOrbitState = {
        orbitPitchDeg: current.orbitPitchDeg,
        orbitYawDeg: current.orbitYawDeg,
        orbitDist: clamp(current.orbitDist - (distance - touchDist) * ORBIT_TOUCH_PINCH_SCALE, ORBIT_DISTANCE_MIN, ORBIT_DISTANCE_MAX),
      };
      setOrbitState(next);
      touchDist = distance;
    }
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    isDragging = false;
  });
}

export function setupPipelinePanelResizer(options: SetupPipelinePanelResizerOptions): void {
  assertPanelResizerOptions(options);

  const { panel, resizer, onResized } = options;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;

  resizer.addEventListener('mousedown', event => {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startW = panel.offsetWidth;
    startH = panel.offsetHeight;
    resizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
    event.preventDefault();
  });

  window.addEventListener('mousemove', event => {
    if (!dragging) return;

    if (window.innerWidth > 900) {
      const newWidth = Math.max(420, Math.min(window.innerWidth - 280, startW + (event.clientX - startX)));
      panel.style.width = `${newWidth}px`;
      panel.style.minWidth = `${newWidth}px`;
      panel.style.maxWidth = `${newWidth}px`;
    } else {
      const newHeight = Math.max(240, Math.min(window.innerHeight - 220, startH + (event.clientY - startY)));
      panel.style.height = `${newHeight}px`;
      panel.style.minHeight = `${newHeight}px`;
      panel.style.maxHeight = `${newHeight}px`;
    }

    onResized?.();
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
}

export function setupPreviewPanelLayoutResizer(options: SetupPreviewPanelLayoutResizerOptions): void {
  assertPreviewResizerOptions(options);

  const { previewPanel, previewDisplay, previewResizer, onStatus } = options;

  let activePointerId: number | null = null;
  let startY = 0;
  let startHeight = 0;

  const minPreviewHeightForViewport = (): number => (window.innerWidth > 900 ? 200 : 170);
  const minSettingsHeightForViewport = (): number => (window.innerWidth > 900 ? 220 : 150);

  const applyPreviewHeight = (requestedHeight: number): void => {
    if (!isFiniteNumber(requestedHeight) || requestedHeight <= 0) {
      onStatus?.('3Dプレビューの高さ入力が不正です。', 'error');
      return;
    }

    const panelHeight = previewPanel.clientHeight;
    const headerHeight = previewPanel.querySelector<HTMLElement>('.preview-header')?.offsetHeight ?? 0;
    const resizerHeight = previewResizer.offsetHeight || 6;
    const minPreviewHeight = minPreviewHeightForViewport();
    const minSettingsHeight = minSettingsHeightForViewport();

    if (!isFiniteNumber(panelHeight) || panelHeight <= 0) {
      previewDisplay.style.flex = `0 0 ${minPreviewHeight}px`;
      return;
    }

    const maxPreviewHeight = Math.max(
      minPreviewHeight,
      panelHeight - headerHeight - resizerHeight - minSettingsHeight,
    );
    const clampedHeight = clamp(requestedHeight, minPreviewHeight, maxPreviewHeight);
    previewDisplay.style.flex = `0 0 ${Math.round(clampedHeight)}px`;
  };

  const syncPreviewHeight = (): void => {
    const currentHeight = previewDisplay.getBoundingClientRect().height;
    if (!isFiniteNumber(currentHeight) || currentHeight <= 0) {
      applyPreviewHeight(window.innerWidth > 900 ? 360 : 300);
      return;
    }

    applyPreviewHeight(currentHeight);
  };

  const finishDrag = (): void => {
    activePointerId = null;
    previewResizer.classList.remove('dragging');
    document.body.style.userSelect = '';
  };

  previewResizer.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;

    activePointerId = event.pointerId;
    startY = event.clientY;
    startHeight = previewDisplay.getBoundingClientRect().height;
    previewResizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
    previewResizer.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  previewResizer.addEventListener('pointermove', event => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;

    const nextHeight = startHeight + (event.clientY - startY);
    if (!isFiniteNumber(nextHeight) || nextHeight <= 0) {
      onStatus?.('3Dプレビュー高さの計算結果が不正です。', 'error');
      return;
    }

    applyPreviewHeight(nextHeight);
  });

  const handlePointerFinish = (event: PointerEvent): void => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    finishDrag();
  };

  previewResizer.addEventListener('pointerup', handlePointerFinish);
  previewResizer.addEventListener('pointercancel', handlePointerFinish);
  previewResizer.addEventListener('lostpointercapture', () => {
    if (activePointerId !== null) {
      finishDrag();
    }
  });

  window.addEventListener('resize', syncPreviewHeight);
  requestAnimationFrame(syncPreviewHeight);
}
