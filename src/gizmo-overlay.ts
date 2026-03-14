import { mat4Multiply } from './math';

interface Point2D {
  x: number;
  y: number;
}

interface LightGizmoElements {
  layer: SVGSVGElement;
  origin: SVGCircleElement;
  tip: SVGCircleElement;
  label: SVGTextElement;
}

interface AxisGizmoElements {
  layer: SVGSVGElement;
  origin: SVGCircleElement;
  lineX: SVGPathElement;
  lineY: SVGPathElement;
  lineZ: SVGPathElement;
  tipX: SVGCircleElement;
  tipY: SVGCircleElement;
  tipZ: SVGCircleElement;
  labelX: SVGTextElement;
  labelY: SVGTextElement;
  labelZ: SVGTextElement;
}

export interface CreateGizmoOverlayControllerOptions {
  light: LightGizmoElements;
  axis: AxisGizmoElements;
}

export interface LightGizmoRenderInput {
  view: Float32Array;
  proj: Float32Array;
  canvas: HTMLCanvasElement;
  lightDirectionWorld: [number, number, number];
  showGizmo: boolean;
}

export interface AxisGizmoRenderInput {
  view: Float32Array;
}

export interface GizmoOverlayController {
  updateLightDirectionGizmo: (input: LightGizmoRenderInput) => void;
  updateAxisGizmo: (input: AxisGizmoRenderInput) => void;
}

interface ElementRenderCache {
  attrs: Map<string, string>;
  styles: Map<string, string>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSvgElement<T extends SVGElement>(value: unknown, expected: string): value is T {
  return value instanceof SVGElement && value.tagName.toLowerCase() === expected;
}

function isFloat32ArrayLike(value: unknown, minLength: number): value is Float32Array {
  return value instanceof Float32Array && value.length >= minLength;
}

function isValidLightDirection(value: unknown): value is [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && isFiniteNumber(value[0])
    && isFiniteNumber(value[1])
    && isFiniteNumber(value[2]);
}

function assertValidLightElements(value: unknown): asserts value is LightGizmoElements {
  if (!isObject(value)) {
    throw new Error('Light gizmo elements must be an object.');
  }

  const candidate = value as Partial<LightGizmoElements>;
  if (!(candidate.layer instanceof SVGSVGElement)) {
    throw new Error('Light gizmo layer must be an SVGSVGElement.');
  }
  if (!isSvgElement<SVGCircleElement>(candidate.origin, 'circle')) {
    throw new Error('Light gizmo origin must be an SVG circle element.');
  }
  if (!isSvgElement<SVGCircleElement>(candidate.tip, 'circle')) {
    throw new Error('Light gizmo tip must be an SVG circle element.');
  }
  if (!isSvgElement<SVGTextElement>(candidate.label, 'text')) {
    throw new Error('Light gizmo label must be an SVG text element.');
  }
}

function assertValidAxisElements(value: unknown): asserts value is AxisGizmoElements {
  if (!isObject(value)) {
    throw new Error('Axis gizmo elements must be an object.');
  }

  const candidate = value as Partial<AxisGizmoElements>;
  if (!(candidate.layer instanceof SVGSVGElement)) {
    throw new Error('Axis gizmo layer must be an SVGSVGElement.');
  }
  if (!isSvgElement<SVGCircleElement>(candidate.origin, 'circle')) {
    throw new Error('Axis gizmo origin must be an SVG circle element.');
  }

  const paths = [candidate.lineX, candidate.lineY, candidate.lineZ];
  for (const path of paths) {
    if (!isSvgElement<SVGPathElement>(path, 'path')) {
      throw new Error('Axis gizmo line elements must be SVG path elements.');
    }
  }

  const circles = [candidate.tipX, candidate.tipY, candidate.tipZ];
  for (const circle of circles) {
    if (!isSvgElement<SVGCircleElement>(circle, 'circle')) {
      throw new Error('Axis gizmo tip elements must be SVG circle elements.');
    }
  }

  const labels = [candidate.labelX, candidate.labelY, candidate.labelZ];
  for (const label of labels) {
    if (!isSvgElement<SVGTextElement>(label, 'text')) {
      throw new Error('Axis gizmo label elements must be SVG text elements.');
    }
  }
}

function assertValidControllerOptions(value: unknown): asserts value is CreateGizmoOverlayControllerOptions {
  if (!isObject(value)) {
    throw new Error('Gizmo overlay controller options must be an object.');
  }

  const candidate = value as Partial<CreateGizmoOverlayControllerOptions>;
  assertValidLightElements(candidate.light);
  assertValidAxisElements(candidate.axis);
}

function assertValidLightRenderInput(value: unknown): asserts value is LightGizmoRenderInput {
  if (!isObject(value)) {
    throw new Error('Light gizmo render input must be an object.');
  }

  const candidate = value as Partial<LightGizmoRenderInput>;
  if (!isFloat32ArrayLike(candidate.view, 16)) {
    throw new Error('Light gizmo input view must be a Float32Array with at least 16 values.');
  }
  if (!isFloat32ArrayLike(candidate.proj, 16)) {
    throw new Error('Light gizmo input proj must be a Float32Array with at least 16 values.');
  }
  if (!(candidate.canvas instanceof HTMLCanvasElement)) {
    throw new Error('Light gizmo input canvas must be an HTMLCanvasElement.');
  }
  if (!isValidLightDirection(candidate.lightDirectionWorld)) {
    throw new Error('Light gizmo input lightDirectionWorld must be [number, number, number].');
  }
  if (typeof candidate.showGizmo !== 'boolean') {
    throw new Error('Light gizmo input showGizmo must be a boolean.');
  }
}

function assertValidAxisRenderInput(value: unknown): asserts value is AxisGizmoRenderInput {
  if (!isObject(value)) {
    throw new Error('Axis gizmo render input must be an object.');
  }

  const candidate = value as Partial<AxisGizmoRenderInput>;
  if (!isFloat32ArrayLike(candidate.view, 11)) {
    throw new Error('Axis gizmo input view must be a Float32Array with at least 11 values.');
  }
}

function projectWorldPointToOverlay(
  point: [number, number, number],
  clipMatrix: Float32Array,
  width: number,
  height: number,
): Point2D | null {
  if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) {
    return null;
  }

  const x = point[0];
  const y = point[1];
  const z = point[2];

  const clipX = clipMatrix[0] * x + clipMatrix[4] * y + clipMatrix[8] * z + clipMatrix[12];
  const clipY = clipMatrix[1] * x + clipMatrix[5] * y + clipMatrix[9] * z + clipMatrix[13];
  const clipZ = clipMatrix[2] * x + clipMatrix[6] * y + clipMatrix[10] * z + clipMatrix[14];
  const clipW = clipMatrix[3] * x + clipMatrix[7] * y + clipMatrix[11] * z + clipMatrix[15];

  if (!isFiniteNumber(clipW) || Math.abs(clipW) < 1e-5) {
    return null;
  }

  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  const ndcZ = clipZ / clipW;
  if (!isFiniteNumber(ndcX) || !isFiniteNumber(ndcY) || !isFiniteNumber(ndcZ)) {
    return null;
  }

  if (ndcZ < -1.2 || ndcZ > 1.2) {
    return null;
  }

  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1 - (ndcY * 0.5 + 0.5)) * height,
  };
}

function createElementCacheAccessor(): {
  setAttrIfChanged: (element: Element, key: string, value: string) => void;
  setStyleIfChanged: (element: Element, key: string, value: string) => void;
} {
  const cache = new WeakMap<Element, ElementRenderCache>();

  const getOrCreate = (element: Element): ElementRenderCache => {
    const existing = cache.get(element);
    if (existing) {
      return existing;
    }

    const created: ElementRenderCache = {
      attrs: new Map<string, string>(),
      styles: new Map<string, string>(),
    };
    cache.set(element, created);
    return created;
  };

  return {
    setAttrIfChanged: (element, key, value) => {
      const state = getOrCreate(element);
      const prev = state.attrs.get(key);
      if (prev === value) {
        return;
      }

      element.setAttribute(key, value);
      state.attrs.set(key, value);
    },
    setStyleIfChanged: (element, key, value) => {
      const state = getOrCreate(element);
      const prev = state.styles.get(key);
      if (prev === value) {
        return;
      }

      (element as HTMLElement).style.setProperty(key, value);
      state.styles.set(key, value);
    },
  };
}

export function createGizmoOverlayController(options: CreateGizmoOverlayControllerOptions): GizmoOverlayController {
  assertValidControllerOptions(options);

  const { setAttrIfChanged, setStyleIfChanged } = createElementCacheAccessor();

  const setLayerOpacity = (layer: SVGSVGElement, opacity: '0' | '1'): void => {
    setStyleIfChanged(layer, 'opacity', opacity);
  };

  return {
    updateLightDirectionGizmo: input => {
      assertValidLightRenderInput(input);

      const { view, proj, canvas, lightDirectionWorld, showGizmo } = input;
      if (!showGizmo) {
        setLayerOpacity(options.light.layer, '0');
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) {
        setLayerOpacity(options.light.layer, '0');
        return;
      }

      setAttrIfChanged(options.light.layer, 'width', String(width));
      setAttrIfChanged(options.light.layer, 'height', String(height));
      setAttrIfChanged(options.light.layer, 'viewBox', `0 0 ${width} ${height}`);

      const viewProj = mat4Multiply(proj, view);
      const origin = projectWorldPointToOverlay([0, 0, 0], viewProj, width, height);
      const tipWorld: [number, number, number] = [
        lightDirectionWorld[0] * 1.35,
        lightDirectionWorld[1] * 1.35,
        lightDirectionWorld[2] * 1.35,
      ];
      const tipProjected = projectWorldPointToOverlay(tipWorld, viewProj, width, height);

      if (!origin || !tipProjected) {
        setLayerOpacity(options.light.layer, '0');
        return;
      }

      let tipX = tipProjected.x;
      let tipY = tipProjected.y;
      const dx = tipX - origin.x;
      const dy = tipY - origin.y;
      const length = Math.hypot(dx, dy);
      if (length < 22) {
        const ux = length > 1e-5 ? dx / length : 0.85;
        const uy = length > 1e-5 ? dy / length : -0.5;
        tipX = origin.x + ux * 22;
        tipY = origin.y + uy * 22;
      }

      setLayerOpacity(options.light.layer, '1');
      setAttrIfChanged(options.light.origin, 'cx', origin.x.toFixed(2));
      setAttrIfChanged(options.light.origin, 'cy', origin.y.toFixed(2));
      setAttrIfChanged(options.light.tip, 'cx', tipX.toFixed(2));
      setAttrIfChanged(options.light.tip, 'cy', tipY.toFixed(2));

      const labelOffsetX = tipX >= origin.x ? 10 : -10;
      const labelOffsetY = tipY >= origin.y ? 13 : -9;
      setAttrIfChanged(options.light.label, 'x', (tipX + labelOffsetX).toFixed(2));
      setAttrIfChanged(options.light.label, 'y', (tipY + labelOffsetY).toFixed(2));
      setAttrIfChanged(options.light.label, 'text-anchor', labelOffsetX >= 0 ? 'start' : 'end');
    },
    updateAxisGizmo: input => {
      assertValidAxisRenderInput(input);

      const { view } = input;
      const centerX = 32;
      const centerY = 32;
      const axisLength = 22;

      setLayerOpacity(options.axis.layer, '1');
      setAttrIfChanged(options.axis.origin, 'cx', String(centerX));
      setAttrIfChanged(options.axis.origin, 'cy', String(centerY));

      const axes = [
        { world: [1, 0, 0] as [number, number, number], lineEl: options.axis.lineX, tipEl: options.axis.tipX, labelEl: options.axis.labelX },
        { world: [0, 1, 0] as [number, number, number], lineEl: options.axis.lineY, tipEl: options.axis.tipY, labelEl: options.axis.labelY },
        { world: [0, 0, 1] as [number, number, number], lineEl: options.axis.lineZ, tipEl: options.axis.tipZ, labelEl: options.axis.labelZ },
      ];

      for (const axis of axes) {
        const wx = axis.world[0];
        const wy = axis.world[1];
        const wz = axis.world[2];

        const camX = view[0] * wx + view[4] * wy + view[8] * wz;
        const camY = view[1] * wx + view[5] * wy + view[9] * wz;
        const camZ = view[2] * wx + view[6] * wy + view[10] * wz;

        if (!isFiniteNumber(camX) || !isFiniteNumber(camY) || !isFiniteNumber(camZ)) {
          setLayerOpacity(options.axis.layer, '0');
          return;
        }

        const tipX = centerX + camX * axisLength;
        const tipY = centerY - camY * axisLength;

        setAttrIfChanged(
          axis.lineEl,
          'd',
          `M ${centerX.toFixed(2)} ${centerY.toFixed(2)} L ${tipX.toFixed(2)} ${tipY.toFixed(2)}`,
        );
        setAttrIfChanged(axis.tipEl, 'cx', tipX.toFixed(2));
        setAttrIfChanged(axis.tipEl, 'cy', tipY.toFixed(2));

        const planarLength = Math.hypot(camX, camY);
        const offsetScale = planarLength > 1e-5 ? (8 / planarLength) : 0;
        const labelX = tipX + camX * offsetScale;
        const labelY = tipY - camY * offsetScale;
        setAttrIfChanged(axis.labelEl, 'x', labelX.toFixed(2));
        setAttrIfChanged(axis.labelEl, 'y', labelY.toFixed(2));

        const alpha = Math.max(0.52, Math.min(1.0, 0.72 - camZ * 0.28));
        const alphaText = alpha.toFixed(3);
        setAttrIfChanged(axis.lineEl, 'opacity', alphaText);
        setAttrIfChanged(axis.tipEl, 'opacity', alphaText);
        setAttrIfChanged(axis.labelEl, 'opacity', alphaText);
      }
    },
  };
}
