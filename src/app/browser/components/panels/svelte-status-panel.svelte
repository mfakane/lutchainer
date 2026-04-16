<svelte:options customElement={{ tag: 'lut-status-panel', shadow: 'none' }} />

<script lang="ts">
  type StatusKind = 'success' | 'error' | 'info';

  export let message = '';
  export let kind: StatusKind = 'info';
</script>

<div class={`status-log status-${kind}`}>{message}</div>

<style>
  .status-log {
    padding: 9px 12px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    line-height: 1.45;
    min-height: 36px;
    max-height: 120px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--color-status-panel, var(--color-panel));
  }

  .status-success {
    color: var(--color-ok, #a6e3a1);
  }

  .status-error {
    color: color-mix(in srgb, var(--color-warn, #f2a65a), var(--color-text-strong) 34%);
    background: color-mix(in srgb, var(--color-warn, #f2a65a), var(--color-bg) 86%);
  }

  .status-info {
    color: color-mix(in srgb, var(--color-muted), var(--color-accent) 24%);
  }
</style>
