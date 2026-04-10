import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { cx } from '../styles/cx.ts';
import * as styles from './solid-status.css.ts';

export type StatusKind = 'success' | 'error' | 'info';

interface StatusState {
  message: string;
  kind: StatusKind;
}

interface StatusLogMountOptions {
  initialMessage?: string;
  initialKind?: StatusKind;
}

let disposeStatusLog: (() => void) | null = null;
let syncStatusLogInternal: ((nextState: StatusState) => void) | null = null;

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

function normalizeInitialState(options: StatusLogMountOptions | undefined): StatusState {
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

function StatusLog(props: { state: () => StatusState }) {
  return <div class={cx(styles.statusLog, styles.statusTone[props.state().kind])}>{props.state().message}</div>;
}

export function mountStatusLog(target: HTMLElement, options?: StatusLogMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('mountStatusLog: target must be an HTMLElement.');
  }

  const initialState = normalizeInitialState(options);

  if (disposeStatusLog) {
    disposeStatusLog();
    disposeStatusLog = null;
  }

  const [state, setState] = createSignal<StatusState>(initialState);
  syncStatusLogInternal = nextState => {
    assertValidStatusState(nextState);
    setState({
      message: nextState.message,
      kind: nextState.kind,
    });
  };

  disposeStatusLog = render(() => <StatusLog state={state} />, target);
}

export function syncStatusLogState(nextState: StatusState): void {
  assertValidStatusState(nextState);
  syncStatusLogInternal?.(nextState);
}
