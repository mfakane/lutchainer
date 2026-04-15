interface UiState {
  previewWireframeOverlay: boolean;
}

const uiState: UiState = {
  previewWireframeOverlay: false,
};

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
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
