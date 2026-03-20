import type {
  CameraOrbitState,
} from '../interactions/layout-interactions.ts';

const DEFAULT_ORBIT_STATE: CameraOrbitState = {
  orbitPitchDeg: 25.0,
  orbitYawDeg: 45.0,
  orbitDist: 2.8,
};

export interface MainOrbitStateController {
  getOrbitState: () => CameraOrbitState;
  setOrbitState: (nextState: CameraOrbitState) => void;
}

interface CreateMainOrbitStateControllerOptions {
  initialState?: CameraOrbitState;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function ensureOptions(value: unknown): asserts value is CreateMainOrbitStateControllerOptions {
  if (value === undefined) {
    return;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Main orbit state options must be an object when provided.');
  }
}

function normalizeOrbitState(value: unknown): CameraOrbitState {
  const source = value as Partial<CameraOrbitState> | null | undefined;

  const orbitPitchDeg = isFiniteNumber(source?.orbitPitchDeg)
    ? source.orbitPitchDeg
    : DEFAULT_ORBIT_STATE.orbitPitchDeg;
  const orbitYawDeg = isFiniteNumber(source?.orbitYawDeg)
    ? source.orbitYawDeg
    : DEFAULT_ORBIT_STATE.orbitYawDeg;
  const orbitDist = isFiniteNumber(source?.orbitDist)
    ? source.orbitDist
    : DEFAULT_ORBIT_STATE.orbitDist;

  return {
    orbitPitchDeg,
    orbitYawDeg,
    orbitDist,
  };
}

export function createMainOrbitStateController(
  options: CreateMainOrbitStateControllerOptions = {},
): MainOrbitStateController {
  ensureOptions(options);

  let orbitState = normalizeOrbitState(options.initialState ?? DEFAULT_ORBIT_STATE);

  return {
    getOrbitState: (): CameraOrbitState => ({ ...orbitState }),
    setOrbitState: (nextState: CameraOrbitState): void => {
      orbitState = normalizeOrbitState(nextState);
    },
  };
}