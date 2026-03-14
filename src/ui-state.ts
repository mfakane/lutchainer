interface UiState {
  autoApply: boolean;
}

const uiState: UiState = {
  autoApply: true,
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