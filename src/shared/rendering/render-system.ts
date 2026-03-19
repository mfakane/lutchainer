import type { LightSettings, MaterialSettings } from '../../features/pipeline/pipeline-model';
import {
  mat4Identity,
  mat4LookAt,
  mat4Perspective,
  normalMatrixFromMat4,
} from '../utils/math';
import { Renderer } from './renderer';

export interface CameraOrbitState {
  orbitPitchDeg: number;
  orbitYawDeg: number;
  orbitDist: number;
}

export interface AfterDrawPayload {
  view: Float32Array;
  proj: Float32Array;
  canvas: HTMLCanvasElement;
  eye: [number, number, number];
  lightDirection: [number, number, number];
  lightSettings: LightSettings;
}

export interface CreateRenderSystemOptions {
  renderer: Renderer;
  getCameraOrbit: () => CameraOrbitState;
  getLightSettings: () => LightSettings;
  getLightDirectionWorld: () => [number, number, number];
  getMaterialSettings: () => MaterialSettings;
  onAfterDraw?: (payload: AfterDrawPayload) => void;
  requestAnimationFrameImpl?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrameImpl?: (handle: number) => void;
}

export interface RenderSystemController {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

const DEG_TO_RAD = Math.PI / 180;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCameraOrbitState(value: unknown): value is CameraOrbitState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CameraOrbitState>;
  return isFiniteNumber(candidate.orbitPitchDeg)
    && isFiniteNumber(candidate.orbitYawDeg)
    && isFiniteNumber(candidate.orbitDist)
    && (candidate.orbitDist ?? 0) > 0;
}

function isLightSettings(value: unknown): value is LightSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LightSettings>;
  return isFiniteNumber(candidate.azimuthDeg)
    && isFiniteNumber(candidate.elevationDeg)
    && typeof candidate.showGizmo === 'boolean';
}

function isMaterialSettings(value: unknown): value is MaterialSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MaterialSettings>;
  return Array.isArray(candidate.baseColor)
    && candidate.baseColor.length === 3
    && isFiniteNumber(candidate.baseColor[0])
    && isFiniteNumber(candidate.baseColor[1])
    && isFiniteNumber(candidate.baseColor[2])
    && Array.isArray(candidate.ambientColor)
    && candidate.ambientColor.length === 3
    && isFiniteNumber(candidate.ambientColor[0])
    && isFiniteNumber(candidate.ambientColor[1])
    && isFiniteNumber(candidate.ambientColor[2])
    && isFiniteNumber(candidate.specularStrength)
    && isFiniteNumber(candidate.specularPower)
    && isFiniteNumber(candidate.fresnelStrength)
    && isFiniteNumber(candidate.fresnelPower);
}

function isLightDirection(value: unknown): value is [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && isFiniteNumber(value[0])
    && isFiniteNumber(value[1])
    && isFiniteNumber(value[2]);
}

function assertValidOptions(value: unknown): asserts value is CreateRenderSystemOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('CreateRenderSystemOptions must be an object.');
  }

  const options = value as Partial<CreateRenderSystemOptions>;
  if (!(options.renderer instanceof Renderer)) {
    throw new Error('renderer must be an instance of Renderer.');
  }
  if (typeof options.getCameraOrbit !== 'function') {
    throw new Error('getCameraOrbit must be a function.');
  }
  if (typeof options.getLightSettings !== 'function') {
    throw new Error('getLightSettings must be a function.');
  }
  if (typeof options.getLightDirectionWorld !== 'function') {
    throw new Error('getLightDirectionWorld must be a function.');
  }
  if (typeof options.getMaterialSettings !== 'function') {
    throw new Error('getMaterialSettings must be a function.');
  }
  if (options.onAfterDraw !== undefined && typeof options.onAfterDraw !== 'function') {
    throw new Error('onAfterDraw must be a function when provided.');
  }
  if (options.requestAnimationFrameImpl !== undefined && typeof options.requestAnimationFrameImpl !== 'function') {
    throw new Error('requestAnimationFrameImpl must be a function when provided.');
  }
  if (options.cancelAnimationFrameImpl !== undefined && typeof options.cancelAnimationFrameImpl !== 'function') {
    throw new Error('cancelAnimationFrameImpl must be a function when provided.');
  }
}

export function createRenderSystem(options: CreateRenderSystemOptions): RenderSystemController {
  assertValidOptions(options);

  const requestFrame = options.requestAnimationFrameImpl ?? requestAnimationFrame;
  const cancelFrame = options.cancelAnimationFrameImpl ?? cancelAnimationFrame;
  let running = false;
  let frameHandle: number | null = null;

  const drawFrame = (): void => {
    if (!running) {
      return;
    }

    frameHandle = requestFrame(drawFrame);

    const orbit = options.getCameraOrbit();
    if (!isCameraOrbitState(orbit)) {
      throw new Error('getCameraOrbit returned an invalid value.');
    }

    const lightSettings = options.getLightSettings();
    if (!isLightSettings(lightSettings)) {
      throw new Error('getLightSettings returned an invalid value.');
    }

    const lightDirection = options.getLightDirectionWorld();
    if (!isLightDirection(lightDirection)) {
      throw new Error('getLightDirectionWorld returned an invalid value.');
    }

    const materialSettings = options.getMaterialSettings();
    if (!isMaterialSettings(materialSettings)) {
      throw new Error('getMaterialSettings returned an invalid value.');
    }

    const canvas = options.renderer.canvas;
    const dpr = window.devicePixelRatio || 1;
    const widthPx = (canvas.clientWidth * dpr) | 0;
    const heightPx = (canvas.clientHeight * dpr) | 0;
    if (canvas.width !== widthPx || canvas.height !== heightPx) {
      canvas.width = widthPx;
      canvas.height = heightPx;
      options.renderer.resize(widthPx, heightPx);
    }

    options.renderer.clear(0.06, 0.08, 0.08);

    const aspect = canvas.width / (canvas.height || 1);
    const proj = mat4Perspective(Math.PI / 4, aspect, 0.1, 100);

    const orbitPitchRad = orbit.orbitPitchDeg * DEG_TO_RAD;
    const orbitYawRad = orbit.orbitYawDeg * DEG_TO_RAD;
    const eyeY = Math.sin(orbitPitchRad) * orbit.orbitDist;
    const rXZ = Math.cos(orbitPitchRad) * orbit.orbitDist;
    const eyeX = Math.sin(orbitYawRad) * rXZ;
    const eyeZ = Math.cos(orbitYawRad) * rXZ;
    const view = mat4LookAt([eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);

    const model = mat4Identity();
    const normal = normalMatrixFromMat4(model);
    options.renderer.draw(
      model,
      view,
      proj,
      normal,
      [eyeX, eyeY, eyeZ],
      lightDirection,
      lightSettings.showGizmo,
      materialSettings,
    );

    options.onAfterDraw?.({
      view,
      proj,
      canvas,
      eye: [eyeX, eyeY, eyeZ],
      lightDirection,
      lightSettings,
    });
  };

  return {
    start: () => {
      if (running) {
        return;
      }

      running = true;
      frameHandle = requestFrame(drawFrame);
    },
    stop: () => {
      if (!running) {
        return;
      }

      running = false;
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
    },
    isRunning: () => running,
  };
}
