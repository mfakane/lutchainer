interface UiState {
  autoApply: boolean;
  previewWireframeOverlay: boolean;
}

const uiState: UiState = {
  autoApply: true,
  previewWireframeOverlay: false,
};

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isAutoApplyEnabled(): boolean {
  return uiState.autoApply;
}

export function setAutoApplyEnabled(value: boolean): void {
  if (!isBoolean(value)) {
    throw new Error(`Invalid autoApply value: ${String(value)}`);
  }

  uiState.autoApply = value;
}

export function isPreviewWireframeOverlayEnabled(): boolean {
  return uiState.previewWireframeOverlay;
}

export function setPreviewWireframeOverlayEnabled(value: boolean): void {
  if (!isBoolean(value)) {
    throw new Error(`Invalid previewWireframeOverlay value: ${String(value)}`);
  }

  uiState.previewWireframeOverlay = value;
}
