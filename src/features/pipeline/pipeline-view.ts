export type SocketAxis = 'x' | 'y';
export type SocketDragState = any;
export type SocketDropTarget = any;

export function isValidSocketAxis(v: string): v is SocketAxis { return v === 'x' || v === 'y'; }
export function clearStepDropIndicators(el: HTMLElement) {}
export function updateStepDropIndicators(el: HTMLElement, state: any) {}
export function clearLutDropIndicators(el: HTMLElement) {}
export function updateLutDropIndicators(el: HTMLElement, state: any) {}
