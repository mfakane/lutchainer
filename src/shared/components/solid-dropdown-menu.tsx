import { Show, createEffect, createSignal, onCleanup, type Accessor, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';

export interface DropdownMenuControls {
  closeMenu: () => void;
  openMenu: () => void;
  toggleMenu: () => void;
  isOpen: Accessor<boolean>;
}

type DropdownMenuRole = 'menu' | 'listbox' | 'dialog' | 'tree' | 'grid';

interface DropdownMenuProps {
  wrapperClass: string;
  triggerClass: string;
  menuClass: string;
  triggerAriaLabel: string;
  triggerContent?: JSX.Element;
  menuRole?: DropdownMenuRole;
  initialOpen?: boolean;
  /** When true the menu uses position:fixed anchored to the trigger, escaping ancestor overflow clipping. */
  floating?: boolean;
  children: (controls: DropdownMenuControls) => JSX.Element;
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`DropdownMenu の ${fieldName} が不正です。`);
  }
}

function assertBooleanOrUndefined(value: unknown, fieldName: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`DropdownMenu の ${fieldName} が不正です。`);
  }
}

function assertFunction(value: unknown, fieldName: string): void {
  if (typeof value !== 'function') {
    throw new Error(`DropdownMenu の ${fieldName} が不正です。`);
  }
}

function ensureDropdownMenuProps(value: unknown): asserts value is DropdownMenuProps {
  if (!value || typeof value !== 'object') {
    throw new Error('DropdownMenu の props が不正です。');
  }

  const props = value as Partial<DropdownMenuProps>;
  assertNonEmptyString(props.wrapperClass, 'wrapperClass');
  assertNonEmptyString(props.triggerClass, 'triggerClass');
  assertNonEmptyString(props.menuClass, 'menuClass');
  assertNonEmptyString(props.triggerAriaLabel, 'triggerAriaLabel');

  if (props.menuRole !== undefined) {
    const allowedRoles: DropdownMenuRole[] = ['menu', 'listbox', 'dialog', 'tree', 'grid'];
    if (!allowedRoles.includes(props.menuRole)) {
      throw new Error('DropdownMenu の menuRole が不正です。');
    }
  }

  assertBooleanOrUndefined(props.initialOpen, 'initialOpen');
  assertBooleanOrUndefined(props.floating, 'floating');
  assertFunction(props.children, 'children');
}

export function DropdownMenu(props: DropdownMenuProps): JSX.Element {
  ensureDropdownMenuProps(props);

  const [isOpen, setIsOpen] = createSignal<boolean>(props.initialOpen ?? false);
  const [floatingStyle, setFloatingStyle] = createSignal<string>('');
  const menuRole = props.menuRole ?? 'menu';
  let wrapperElement: HTMLDivElement | null = null;
  let triggerElement: HTMLButtonElement | null = null;
  let menuElement: HTMLDivElement | null = null;

  const closeMenu = (): void => {
    setIsOpen(false);
  };

  const openMenu = (): void => {
    setIsOpen(true);
  };

  const toggleMenu = (): void => {
    setIsOpen(prev => !prev);
  };

  const controls: DropdownMenuControls = {
    closeMenu,
    openMenu,
    toggleMenu,
    isOpen,
  };

  const getFocusableMenuItems = (): HTMLElement[] => {
    if (!menuElement) {
      return [];
    }

    const candidates = Array.from(
      menuElement.querySelectorAll<HTMLElement>('[role="menuitem"], button, a[href], [tabindex]:not([tabindex="-1"])'),
    );

    return candidates.filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true');
  };

  const focusFirstMenuItem = (): void => {
    const items = getFocusableMenuItems();
    if (items.length === 0) {
      return;
    }
    items[0].focus();
  };

  const focusLastMenuItem = (): void => {
    const items = getFocusableMenuItems();
    if (items.length === 0) {
      return;
    }
    items[items.length - 1].focus();
  };

  const moveMenuItemFocus = (direction: 1 | -1): void => {
    const items = getFocusableMenuItems();
    if (items.length === 0) {
      return;
    }

    const activeElement = document.activeElement;
    const currentIndex = items.findIndex(item => item === activeElement);
    if (currentIndex < 0) {
      if (direction === 1) {
        items[0].focus();
      } else {
        items[items.length - 1].focus();
      }
      return;
    }

    const nextIndex = (currentIndex + direction + items.length) % items.length;
    items[nextIndex].focus();
  };

  const handleWindowPointerDown = (event: PointerEvent): void => {
    if (!isOpen()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (wrapperElement?.contains(target) ?? false) {
      return;
    }

    if (menuElement?.contains(target) ?? false) {
      return;
    }

    closeMenu();
  };

  const handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (!isOpen() || event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    closeMenu();
    triggerElement?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent): void => {
    if (!isOpen()) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveMenuItemFocus(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveMenuItemFocus(-1);
      return;
    }

    if (event.key === 'Enter') {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && menuElement?.contains(activeElement)) {
        event.preventDefault();
        activeElement.click();
      }
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen()) {
        openMenu();
      }
      queueMicrotask(() => {
        focusFirstMenuItem();
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen()) {
        openMenu();
      }
      queueMicrotask(() => {
        focusLastMenuItem();
      });
    }
  };

  createEffect(() => {
    if (!isOpen()) {
      return;
    }

    queueMicrotask(() => {
      focusFirstMenuItem();
    });
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', handleWindowPointerDown);
    window.addEventListener('keydown', handleWindowKeyDown);

    onCleanup(() => {
      window.removeEventListener('pointerdown', handleWindowPointerDown);
      window.removeEventListener('keydown', handleWindowKeyDown);
    });
  }

  return (
    <div class={props.wrapperClass} ref={element => { wrapperElement = element; }}>
      <button
        type="button"
        ref={element => { triggerElement = element; }}
        class={props.triggerClass}
        aria-label={props.triggerAriaLabel}
        aria-haspopup={menuRole}
        aria-expanded={isOpen() ? 'true' : 'false'}
        onClick={() => {
            if (props.floating && triggerElement && !isOpen()) {
              const rect = triggerElement.getBoundingClientRect();
              setFloatingStyle(
                `position:fixed;` +
                `right:${Math.round(window.innerWidth - rect.right)}px;` +
                `bottom:${Math.round(window.innerHeight - rect.top)}px;`,
              );
            } else if (!props.floating) {
              setFloatingStyle('');
            }
            toggleMenu();
          }}
        onKeyDown={event => {
          handleTriggerKeyDown(event as KeyboardEvent);
        }}
      >
        {props.triggerContent ?? '･･･'}
      </button>
      <Show when={isOpen()}>
        <Show
          when={props.floating}
          fallback={
            <div
              ref={element => { menuElement = element; }}
              class={props.menuClass}
              role={menuRole}
              onKeyDown={event => { handleMenuKeyDown(event as KeyboardEvent); }}
            >
              {props.children(controls)}
            </div>
          }
        >
          <Portal mount={document.body}>
            <div
              ref={element => { menuElement = element; }}
              class={props.menuClass}
              role={menuRole}
              style={floatingStyle() || undefined}
              onKeyDown={event => { handleMenuKeyDown(event as KeyboardEvent); }}
            >
              {props.children(controls)}
            </div>
          </Portal>
        </Show>
      </Show>
    </div>
  );
}
