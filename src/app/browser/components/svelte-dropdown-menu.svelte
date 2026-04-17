<script lang="ts">
  import { tick } from 'svelte';
  import Button from './svelte-button.svelte';

  export let wrapperClass = '';
  export let menuClass = '';
  export let triggerAriaLabel = '';
  export let menuRole: 'menu' | 'listbox' | 'dialog' | 'tree' | 'grid' = 'menu';
  export let triggerText = '';
  export let triggerVariant: 'default' | 'secondary' | 'submit' | 'destructive' | 'menu-trigger' = 'default';
  export let triggerClassName = '';
  export let floating = false;
  export let onOpen: (() => void) | undefined = undefined;
  export let onClose: (() => void) | undefined = undefined;

  let isOpen = false;
  let wrapperEl: HTMLDivElement | null = null;
  let triggerEl: HTMLButtonElement | null = null;
  let menuEl: HTMLDivElement | null = null;
  let menuPlacement: 'down' | 'up' = 'down';
  let floatingStyle = '';
  let portalHost: HTMLElement | null = null;

  function portal(node: HTMLElement) {
    if (!floating || typeof document === 'undefined') {
      return {
        destroy() {
          return undefined;
        },
      };
    }

    portalHost = wrapperEl?.closest('dialog') ?? document.body;
    portalHost.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
        portalHost = null;
      },
    };
  }

  async function updateMenuPlacement(): Promise<void> {
    if (!isOpen) {
      return;
    }

    await tick();
    if (!triggerEl || !menuEl) {
      return;
    }

    const triggerRect = triggerEl.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom - 8;
    const spaceAbove = triggerRect.top - 8;

    if (menuRect.height > spaceBelow && spaceAbove > spaceBelow) {
      menuPlacement = 'up';
    } else {
      menuPlacement = 'down';
    }

    if (!floating) {
      floatingStyle = '';
      return;
    }

    const menuWidth = menuRect.width;
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - menuWidth - margin);
    const alignedLeft = Math.min(
      maxLeft,
      Math.max(margin, triggerRect.right - menuWidth),
    );
    const top = menuPlacement === 'up'
      ? Math.max(margin, triggerRect.top - menuRect.height - 8)
      : Math.min(window.innerHeight - menuRect.height - margin, triggerRect.bottom + 8);

    floatingStyle = [
      'position:fixed',
      `left:${Math.round(alignedLeft)}px`,
      `top:${Math.round(top)}px`,
      'right:auto',
      'bottom:auto',
    ].join(';');
  }

  function focusWithoutScroll(element: HTMLElement | null): void {
    element?.focus({ preventScroll: true });
  }

  function closeMenu(): void {
    if (!isOpen) {
      return;
    }
    isOpen = false;
    onClose?.();
  }

  function toggleMenu(): void {
    isOpen = !isOpen;
    if (isOpen) {
      onOpen?.();
      void updateMenuPlacement();
      return;
    }

    onClose?.();
  }

  function getFocusableItems(): HTMLElement[] {
    if (!menuEl) {
      return [];
    }

    return Array.from(
      menuEl.querySelectorAll<HTMLElement>('[role="menuitem"], button, a[href], [tabindex]:not([tabindex="-1"])'),
    ).filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true');
  }

  function focusBoundary(which: 'first' | 'last'): void {
    const items = getFocusableItems();
    if (items.length === 0) {
      return;
    }

    if (which === 'first') {
      focusWithoutScroll(items[0]);
      return;
    }

    focusWithoutScroll(items[items.length - 1]);
  }

  function moveFocus(direction: 1 | -1): void {
    const items = getFocusableItems();
    if (items.length === 0) {
      return;
    }

    const active = document.activeElement;
    const currentIndex = items.findIndex(item => item === active);
    if (currentIndex < 0) {
      focusBoundary(direction === 1 ? 'first' : 'last');
      return;
    }

    const nextIndex = (currentIndex + direction + items.length) % items.length;
    items[nextIndex].focus();
  }

  function handleGlobalPointerDown(event: PointerEvent): void {
    if (!isOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (wrapperEl?.contains(target) || menuEl?.contains(target)) {
      return;
    }

    closeMenu();
  }

  function handleGlobalKeyDown(event: KeyboardEvent): void {
    if (!isOpen || event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    closeMenu();
    focusWithoutScroll(triggerEl);
  }

  function handleTriggerKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      isOpen = true;
      void updateMenuPlacement();
      queueMicrotask(() => focusBoundary('first'));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      isOpen = true;
      void updateMenuPlacement();
      queueMicrotask(() => focusBoundary('last'));
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent): void {
    if (!isOpen) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-1);
      return;
    }

    if (event.key === 'Enter') {
      const active = document.activeElement;
      if (active instanceof HTMLElement && menuEl?.contains(active)) {
        event.preventDefault();
        active.click();
      }
    }
  }

  $: if (typeof window !== 'undefined') {
    window.removeEventListener('pointerdown', handleGlobalPointerDown);
    window.removeEventListener('keydown', handleGlobalKeyDown);
    if (isOpen) {
      window.addEventListener('pointerdown', handleGlobalPointerDown);
      window.addEventListener('keydown', handleGlobalKeyDown);
      window.addEventListener('resize', updateMenuPlacement);
      window.addEventListener('scroll', updateMenuPlacement, true);
      queueMicrotask(() => focusBoundary('first'));
      queueMicrotask(() => {
        void updateMenuPlacement();
      });
    } else {
      window.removeEventListener('resize', updateMenuPlacement);
      window.removeEventListener('scroll', updateMenuPlacement, true);
    }
  }
</script>

<svelte:window on:beforeunload={closeMenu} />

<div class={wrapperClass} bind:this={wrapperEl}>
  <Button
    bind:element={triggerEl}
    type="button"
    variant={triggerVariant}
    className={triggerClassName}
    ariaLabel={triggerAriaLabel}
    ariaHaspopup={menuRole}
    ariaExpanded={isOpen ? 'true' : 'false'}
    handleMouseDown={event => event.preventDefault()}
    handlePress={toggleMenu}
    handleKeyPress={handleTriggerKeyDown}
  >
    <slot name="trigger">{triggerText || '･･･'}</slot>
  </Button>
  {#if isOpen}
    <div
      use:portal
      bind:this={menuEl}
      class={`${menuClass} ${menuPlacement === 'up' ? 'ui-menu-open-up' : 'ui-menu-open-down'}`.trim()}
      role={menuRole}
      style={floating ? floatingStyle : undefined}
      on:pointerdown|stopPropagation
      on:keydown={handleMenuKeyDown}
    >
      <slot {closeMenu} />
    </div>
  {/if}
</div>

<style>
  :global(.ui-menu-open-down) {
    top: calc(100% + 8px);
    bottom: auto;
  }

  :global(.ui-menu-open-up) {
    top: auto;
    bottom: calc(100% + 8px);
  }
</style>
