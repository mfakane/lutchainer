import { createSignal, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { cx } from '../../styles/cx.ts';
import * as statusStyles from '../solid-status.css.ts';
import type { StatusKind } from './shared.ts';

interface StatusState {
  message: string;
  kind: StatusKind;
}

interface StatusPanelMountOptions {
  initialMessage?: string;
  initialKind?: StatusKind;
}

let disposeStatusPanel: (() => void) | null = null;
let syncStatusPanelInternal: ((nextState: StatusState) => void) | null = null;

function isValidStatusKind(value: unknown): value is StatusKind {
  return value === 'success' || value === 'error' || value === 'info';
}

function isValidStatusMessage(value: unknown): value is string {
  return typeof value === 'string';
}

function assertValidStatusState(value: unknown): asserts value is StatusState {
  if (!value || typeof value !== 'object') {
    throw new Error('Status state must be an object.');
  }

  const candidate = value as Partial<StatusState>;
  if (!isValidStatusMessage(candidate.message)) {
    throw new Error('Status message must be a string.');
  }

  if (!isValidStatusKind(candidate.kind)) {
    throw new Error(`Invalid status kind: ${String(candidate.kind)}`);
  }
}

function normalizeInitialState(options: StatusPanelMountOptions | undefined): StatusState {
  const message = options?.initialMessage;
  const kind = options?.initialKind;

  if (message !== undefined && !isValidStatusMessage(message)) {
    throw new Error('initialMessage must be a string when provided.');
  }

  if (kind !== undefined && !isValidStatusKind(kind)) {
    throw new Error(`Invalid initialKind: ${String(kind)}`);
  }

  return {
    message: message ?? '',
    kind: kind ?? 'info',
  };
}

export function StatusPanel(props: { state: () => StatusState }): JSX.Element {
  return (
    <div class={cx(statusStyles.statusLog, statusStyles.statusTone[props.state().kind])}>
      {props.state().message}
    </div>
  );
}

export function mountStatusPanel(target: HTMLElement, options?: StatusPanelMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('mountStatusPanel: target must be an HTMLElement.');
  }

  const initialState = normalizeInitialState(options);

  if (disposeStatusPanel) {
    disposeStatusPanel();
    disposeStatusPanel = null;
  }

  target.textContent = '';
  const [state, setState] = createSignal<StatusState>(initialState);
  syncStatusPanelInternal = nextState => {
    assertValidStatusState(nextState);
    setState({
      message: nextState.message,
      kind: nextState.kind,
    });
  };

  disposeStatusPanel = render(() => <StatusPanel state={state} />, target);
}

export function syncStatusPanelState(nextState: StatusState): void {
  assertValidStatusState(nextState);
  syncStatusPanelInternal?.(nextState);
}
