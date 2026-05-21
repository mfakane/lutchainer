<svelte:options customElement={{ tag: 'lut-pipeline-tab-bar', shadow: 'none' }} />

<script lang="ts">
  export interface PipelineTab {
    id: string;
    label: string;
    isDirty: boolean;
    kind: 'pipeline' | 'lut';
  }

  const {
    tabs = [],
    activeTabId = 'pipeline',
  }: {
    tabs?: PipelineTab[];
    activeTabId?: string;
  } = $props();

  function dispatch(name: string, detail?: unknown): void {
    $host().dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
</script>

<div class="tab-bar" role="tablist">
  {#each tabs as tab (tab.id)}
    <div
      class="tab-btn"
      class:active={tab.id === activeTabId}
      role="tab"
      aria-selected={tab.id === activeTabId}
      tabindex={tab.id === activeTabId ? 0 : -1}
      onclick={() => dispatch('tab-select', { tabId: tab.id })}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch('tab-select', { tabId: tab.id }); } }}
    >
      <span class="tab-label">{tab.label}</span>
      {#if tab.isDirty}
        <span class="dirty-dot" title="未適用の変更があります" aria-label="変更あり">●</span>
      {/if}
      {#if tab.kind === 'lut'}
        <button
          class="close-btn"
          type="button"
          title="タブを閉じる"
          aria-label="タブを閉じる"
          onclick={(e) => { e.stopPropagation(); dispatch('tab-close-request', { tabId: tab.id }); }}
        >×</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .tab-bar {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 0;
    padding: 0 8px;
    border-bottom: 1px solid var(--color-line);
    background: color-mix(in srgb, var(--color-panel-2), #000 6%);
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 12px;
    height: 34px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-muted);
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    user-select: none;
    position: relative;
    transition: color 0.1s, border-color 0.1s;
  }

  .tab-btn:hover {
    color: var(--color-text);
  }

  .tab-btn.active {
    color: var(--color-text-strong);
    font-weight: 600;
    border-bottom-color: var(--color-accent);
  }

  .tab-label {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dirty-dot {
    font-size: 8px;
    color: var(--color-accent);
    line-height: 1;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 2px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--color-muted);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: color-mix(in srgb, var(--color-line), transparent 40%);
    color: var(--color-text-strong);
  }
</style>
