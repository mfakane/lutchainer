import {
  mat4LookAt,
  mat4Perspective,
  type Mat4,
} from '../utils/math.ts';
import type {
  LightSettings,
  MaterialSettings,
} from '../../features/pipeline/pipeline-model.ts';

export interface CameraOrbitState {
  orbitPitchDeg: number;
  orbitYawDeg: number;
  orbitDist: number;
}

interface SampleOffset {
  id: string;
  u: number;
  v: number;
}

interface RegisterGlobalDebugApiOptions {
  globalObject: Record<string, unknown>;
  globalKey?: string;
}

interface CreateMainPreviewDebugControllerOptions {
  canvas: HTMLCanvasElement;
  getOrbitState: () => CameraOrbitState;
  setOrbitState: (nextState: CameraOrbitState) => void;
  getMaterialSettings: () => MaterialSettings;
  setMaterialSettings: (nextState: MaterialSettings) => void;
  getLightSettings: () => LightSettings;
  setLightSettings: (nextState: LightSettings) => void;
  loadPreset: (preset: string) => Promise<void>;
}

interface SampleSpherePointsOptions {
  orbit?: Partial<CameraOrbitState>;
}

interface SampleGridOptions {
  orbit?: Partial<CameraOrbitState>;
  divisions?: number;
  outputSize?: number;
}

interface SampleColorResult {
  id: string;
  uvOffset: [number, number];
  point: [number, number, number];
  pixel: [number, number];
  rgba: [number, number, number, number];
}

interface GridSampleColorResult {
  id: string;
  row: number;
  col: number;
  pixel: [number, number];
  rgba: [number, number, number, number];
}

export interface MainPreviewSampleReport {
  canvas: {
    width: number;
    height: number;
  };
  orbit: CameraOrbitState;
  divisions: number;
  samples: Array<SampleColorResult | GridSampleColorResult>;
}

export interface MainPreviewDebugApi {
  getOrbit: () => CameraOrbitState;
  setOrbit: (nextState: Partial<CameraOrbitState>) => CameraOrbitState;
  resetOrbit: () => CameraOrbitState;
  getMaterialSettings: () => MaterialSettings;
  setMaterialSettings: (patch: Partial<MaterialSettings>) => MaterialSettings;
  setBaseColor: (color: [number, number, number]) => MaterialSettings;
  getLightSettings: () => LightSettings;
  setLightSettings: (patch: Partial<LightSettings>) => LightSettings;
  loadPreset: (preset: string) => Promise<void>;
  sampleSpherePoints: (options?: SampleSpherePointsOptions) => Promise<MainPreviewSampleReport>;
  setOrbitAndSampleSphere: (nextState: Partial<CameraOrbitState>) => Promise<MainPreviewSampleReport>;
  sampleGrid: (options?: SampleGridOptions) => Promise<MainPreviewSampleReport>;
  setOrbitAndSampleGrid: (nextState: Partial<CameraOrbitState>, divisions?: number) => Promise<MainPreviewSampleReport>;
  exportFixedSizePng: (size?: number) => Promise<string>;
}

export interface MainPreviewDebugController {
  createDebugApi: () => MainPreviewDebugApi;
  registerGlobalDebugApi: (options: RegisterGlobalDebugApiOptions) => void;
}

const DEFAULT_ORBIT_STATE: CameraOrbitState = {
  orbitPitchDeg: 25.0,
  orbitYawDeg: 45.0,
  orbitDist: 2.8,
};

const DEFAULT_SAMPLE_OFFSETS: readonly SampleOffset[] = [
  { id: 'center', u: 0.0, v: 0.0 },
  { id: 'left', u: -0.35, v: 0.0 },
  { id: 'right', u: 0.35, v: 0.0 },
  { id: 'up', u: 0.0, v: 0.35 },
  { id: 'down', u: 0.0, v: -0.35 },
  { id: 'upperLeft', u: -0.25, v: 0.25 },
  { id: 'upperRight', u: 0.25, v: 0.25 },
  { id: 'lowerLeft', u: -0.25, v: -0.25 },
  { id: 'lowerRight', u: 0.25, v: -0.25 },
];

const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_FOV_Y = Math.PI / 4;
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100;
const DEFAULT_GLOBAL_KEY = '__debugMainPreview';
const DEFAULT_GRID_DIVISIONS = 8;
const DEFAULT_OUTPUT_SIZE = 512;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeOrbitState(source: Partial<CameraOrbitState> | null | undefined): CameraOrbitState {
  return {
    orbitPitchDeg: isFiniteNumber(source?.orbitPitchDeg) ? source.orbitPitchDeg : DEFAULT_ORBIT_STATE.orbitPitchDeg,
    orbitYawDeg: isFiniteNumber(source?.orbitYawDeg) ? source.orbitYawDeg : DEFAULT_ORBIT_STATE.orbitYawDeg,
    orbitDist: isFiniteNumber(source?.orbitDist) ? source.orbitDist : DEFAULT_ORBIT_STATE.orbitDist,
  };
}

function waitForNextFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

function normalizeVec3(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function crossVec3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function multiplyMat4Vec4(
  matrix: Mat4,
  vector: readonly [number, number, number, number],
): [number, number, number, number] {
  return [
    matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2] + matrix[12] * vector[3],
    matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2] + matrix[13] * vector[3],
    matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2] + matrix[14] * vector[3],
    matrix[3] * vector[0] + matrix[7] * vector[1] + matrix[11] * vector[2] + matrix[15] * vector[3],
  ];
}

function projectPointToPixel(
  point: readonly [number, number, number],
  view: Mat4,
  proj: Mat4,
  width: number,
  height: number,
): [number, number] {
  const viewPosition = multiplyMat4Vec4(view, [point[0], point[1], point[2], 1]);
  const clipPosition = multiplyMat4Vec4(proj, viewPosition);
  const invW = clipPosition[3] !== 0 ? 1 / clipPosition[3] : 0;
  const ndcX = clipPosition[0] * invW;
  const ndcY = clipPosition[1] * invW;
  const pixelX = Math.round(((ndcX + 1) * 0.5) * (width - 1));
  const pixelY = Math.round((1 - ((ndcY + 1) * 0.5)) * (height - 1));
  return [pixelX, pixelY];
}

function buildSphereSamplePoints(orbit: CameraOrbitState): SampleColorResult[] {
  const orbitPitchRad = orbit.orbitPitchDeg * DEG_TO_RAD;
  const orbitYawRad = orbit.orbitYawDeg * DEG_TO_RAD;
  const eyeY = Math.sin(orbitPitchRad) * orbit.orbitDist;
  const radiusXZ = Math.cos(orbitPitchRad) * orbit.orbitDist;
  const eyeX = Math.sin(orbitYawRad) * radiusXZ;
  const eyeZ = Math.cos(orbitYawRad) * radiusXZ;
  const eye = [eyeX, eyeY, eyeZ] as const;
  const forward = normalizeVec3(eye[0], eye[1], eye[2]);
  const worldUp = [0, 1, 0] as const;
  let right = normalizeVec3(...crossVec3(worldUp, forward));
  if (!Number.isFinite(right[0]) || !Number.isFinite(right[1]) || !Number.isFinite(right[2])) {
    right = [1, 0, 0];
  }
  const up = normalizeVec3(...crossVec3(forward, right));

  return DEFAULT_SAMPLE_OFFSETS.map(offset => {
    const point = normalizeVec3(
      forward[0] + right[0] * offset.u + up[0] * offset.v,
      forward[1] + right[1] * offset.u + up[1] * offset.v,
      forward[2] + right[2] * offset.u + up[2] * offset.v,
    );
    return {
      id: offset.id,
      uvOffset: [offset.u, offset.v],
      point,
      pixel: [0, 0],
      rgba: [0, 0, 0, 0],
    };
  });
}

function buildGridSamplePixels(width: number, height: number, divisions: number): GridSampleColorResult[] {
  const safeDivisions = Math.max(1, Math.floor(divisions));
  const samples: GridSampleColorResult[] = [];
  for (let row = 0; row < safeDivisions; row += 1) {
    for (let col = 0; col < safeDivisions; col += 1) {
      const pixelX = Math.round(((col + 0.5) / safeDivisions) * (width - 1));
      const pixelY = Math.round(((row + 0.5) / safeDivisions) * (height - 1));
      samples.push({
        id: `r${row}-c${col}`,
        row,
        col,
        pixel: [pixelX, pixelY],
        rgba: [0, 0, 0, 0],
      });
    }
  }
  return samples;
}

function createOutputSurface(
  sourceCanvas: HTMLCanvasElement,
  outputSize: number,
): { canvas: HTMLCanvasElement; context2d: CanvasRenderingContext2D } {
  const safeSize = Math.max(1, Math.floor(outputSize));
  const offscreen = document.createElement('canvas');
  offscreen.width = safeSize;
  offscreen.height = safeSize;
  const context2d = offscreen.getContext('2d', { willReadFrequently: true });
  if (!context2d) {
    throw new Error('Failed to create a 2D context for preview output.');
  }
  context2d.clearRect(0, 0, safeSize, safeSize);
  context2d.drawImage(sourceCanvas, 0, 0, safeSize, safeSize);
  return { canvas: offscreen, context2d };
}

function assertOptions(value: unknown): asserts value is CreateMainPreviewDebugControllerOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Main preview debug controller options must be an object.');
  }
  const options = value as Partial<CreateMainPreviewDebugControllerOptions>;
  if (!(options.canvas instanceof HTMLCanvasElement)) {
    throw new Error('Main preview debug controller canvas must be an HTMLCanvasElement.');
  }
  if (typeof options.getOrbitState !== 'function') {
    throw new Error('Main preview debug controller getOrbitState must be a function.');
  }
  if (typeof options.setOrbitState !== 'function') {
    throw new Error('Main preview debug controller setOrbitState must be a function.');
  }
  if (typeof options.getMaterialSettings !== 'function') {
    throw new Error('Main preview debug controller getMaterialSettings must be a function.');
  }
  if (typeof options.setMaterialSettings !== 'function') {
    throw new Error('Main preview debug controller setMaterialSettings must be a function.');
  }
  if (typeof options.getLightSettings !== 'function') {
    throw new Error('Main preview debug controller getLightSettings must be a function.');
  }
  if (typeof options.setLightSettings !== 'function') {
    throw new Error('Main preview debug controller setLightSettings must be a function.');
  }
  if (typeof options.loadPreset !== 'function') {
    throw new Error('Main preview debug controller loadPreset must be a function.');
  }
}

function resolveGlobalKey(value: unknown): string {
  if (value === undefined) {
    return DEFAULT_GLOBAL_KEY;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Main preview debug global key must be a non-empty string.');
  }
  return value;
}

export function createMainPreviewDebugController(
  options: CreateMainPreviewDebugControllerOptions,
): MainPreviewDebugController {
  assertOptions(options);

  const {
    canvas,
    getOrbitState,
    setOrbitState,
    getMaterialSettings,
    setMaterialSettings,
    getLightSettings,
    setLightSettings,
    loadPreset,
  } = options;

  const setOrbit = (nextState: Partial<CameraOrbitState>): CameraOrbitState => {
    const current = getOrbitState();
    const merged = normalizeOrbitState({
      orbitPitchDeg: nextState.orbitPitchDeg ?? current.orbitPitchDeg,
      orbitYawDeg: nextState.orbitYawDeg ?? current.orbitYawDeg,
      orbitDist: nextState.orbitDist ?? current.orbitDist,
    });
    setOrbitState(merged);
    return getOrbitState();
  };

  const sampleSpherePoints = async (sampleOptions: SampleSpherePointsOptions = {}): Promise<MainPreviewSampleReport> => {
    const orbit = sampleOptions.orbit ? setOrbit(sampleOptions.orbit) : getOrbitState();
    await waitForNextFrame();
    await waitForNextFrame();

    const width = canvas.width;
    const height = canvas.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const context2d = offscreen.getContext('2d', { willReadFrequently: true });
    if (!context2d) {
      throw new Error('Failed to create a 2D context for preview sampling.');
    }
    context2d.drawImage(canvas, 0, 0);

    const aspect = width / Math.max(height, 1);
    const proj = mat4Perspective(DEFAULT_FOV_Y, aspect, DEFAULT_NEAR, DEFAULT_FAR);
    const orbitPitchRad = orbit.orbitPitchDeg * DEG_TO_RAD;
    const orbitYawRad = orbit.orbitYawDeg * DEG_TO_RAD;
    const eyeY = Math.sin(orbitPitchRad) * orbit.orbitDist;
    const radiusXZ = Math.cos(orbitPitchRad) * orbit.orbitDist;
    const eyeX = Math.sin(orbitYawRad) * radiusXZ;
    const eyeZ = Math.cos(orbitYawRad) * radiusXZ;
    const view = mat4LookAt([eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);

    const samples = buildSphereSamplePoints(orbit).map(sample => {
      const pixel = projectPointToPixel(sample.point, view, proj, width, height);
      const clampedX = Math.max(0, Math.min(width - 1, pixel[0]));
      const clampedY = Math.max(0, Math.min(height - 1, pixel[1]));
      const imageData = context2d.getImageData(clampedX, clampedY, 1, 1);
      return {
        ...sample,
        pixel: [clampedX, clampedY] as [number, number],
        rgba: [
          imageData.data[0],
          imageData.data[1],
          imageData.data[2],
          imageData.data[3],
        ] as [number, number, number, number],
      };
    });

    return {
      canvas: { width, height },
      orbit,
      divisions: 0,
      samples,
    };
  };

  const sampleGrid = async (sampleOptions: SampleGridOptions = {}): Promise<MainPreviewSampleReport> => {
    const orbit = sampleOptions.orbit ? setOrbit(sampleOptions.orbit) : getOrbitState();
    const divisions = Math.max(1, Math.floor(sampleOptions.divisions ?? DEFAULT_GRID_DIVISIONS));
    const outputSize = Math.max(1, Math.floor(sampleOptions.outputSize ?? DEFAULT_OUTPUT_SIZE));
    await waitForNextFrame();
    await waitForNextFrame();

    const { canvas: outputCanvas, context2d } = createOutputSurface(canvas, outputSize);
    const width = outputCanvas.width;
    const height = outputCanvas.height;

    const samples = buildGridSamplePixels(width, height, divisions).map(sample => {
      const imageData = context2d.getImageData(sample.pixel[0], sample.pixel[1], 1, 1);
      return {
        ...sample,
        rgba: [
          imageData.data[0],
          imageData.data[1],
          imageData.data[2],
          imageData.data[3],
        ] as [number, number, number, number],
      };
    });

    return {
      canvas: { width, height },
      orbit,
      divisions,
      samples,
    };
  };

  const createDebugApi = (): MainPreviewDebugApi => ({
    getOrbit: () => getOrbitState(),
    setOrbit,
    resetOrbit: () => setOrbit(DEFAULT_ORBIT_STATE),
    getMaterialSettings: () => getMaterialSettings(),
    setMaterialSettings: (patch: Partial<MaterialSettings>) => {
      const current = getMaterialSettings();
      const next: MaterialSettings = {
        ...current,
        ...patch,
        baseColor: Array.isArray(patch.baseColor) ? patch.baseColor : current.baseColor,
      };
      setMaterialSettings(next);
      return getMaterialSettings();
    },
    setBaseColor: (color: [number, number, number]) => {
      setMaterialSettings({
        ...getMaterialSettings(),
        baseColor: color,
      });
      return getMaterialSettings();
    },
    getLightSettings: () => getLightSettings(),
    setLightSettings: (patch: Partial<LightSettings>) => {
      const current = getLightSettings();
      const next: LightSettings = {
        ...current,
        ...patch,
        lightColor: Array.isArray(patch.lightColor) ? patch.lightColor : current.lightColor,
        ambientColor: Array.isArray(patch.ambientColor) ? patch.ambientColor : current.ambientColor,
      };
      setLightSettings(next);
      return getLightSettings();
    },
    loadPreset: async (preset: string) => {
      await loadPreset(preset);
      await waitForNextFrame();
      await waitForNextFrame();
    },
    sampleSpherePoints,
    setOrbitAndSampleSphere: async (nextState: Partial<CameraOrbitState>) => {
      setOrbit(nextState);
      return sampleSpherePoints();
    },
    sampleGrid,
    setOrbitAndSampleGrid: async (nextState: Partial<CameraOrbitState>, divisions?: number) => {
      setOrbit(nextState);
      return sampleGrid({ divisions });
    },
    exportFixedSizePng: async (size?: number) => {
      await waitForNextFrame();
      await waitForNextFrame();
      const { canvas: outputCanvas } = createOutputSurface(canvas, size ?? DEFAULT_OUTPUT_SIZE);
      return outputCanvas.toDataURL('image/png');
    },
  });

  const registerGlobalDebugApi = (registerOptions: RegisterGlobalDebugApiOptions): void => {
    if (!registerOptions || typeof registerOptions !== 'object' || Array.isArray(registerOptions)) {
      throw new Error('Main preview debug registration options must be an object.');
    }
    if (!registerOptions.globalObject || typeof registerOptions.globalObject !== 'object' || Array.isArray(registerOptions.globalObject)) {
      throw new Error('Main preview debug registration object must be an object.');
    }
    const globalKey = resolveGlobalKey(registerOptions.globalKey);
    registerOptions.globalObject[globalKey] = createDebugApi();
  };

  return {
    createDebugApi,
    registerGlobalDebugApi,
  };
}
