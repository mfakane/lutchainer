export type SocketAxis = 'x' | 'y';

export interface StepReorderDragState {
  stepId: string;
  overStepId: string | null;
  dropAfter: boolean;
}

export interface LutReorderDragState {
  lutId: string;
  overLutId: string | null;
  dropAfter: boolean;
}

export function isValidSocketAxis(value: string): value is SocketAxis {
  return value === 'x' || value === 'y';
}
