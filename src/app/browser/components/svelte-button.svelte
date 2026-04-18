<script lang="ts">
  import type { Snippet } from "svelte";
  import type { AriaAttributes } from "svelte/elements";

  type ButtonVariant =
    | "default"
    | "secondary"
    | "submit"
    | "destructive"
    | "small"
    | "menu-trigger"
    | "menu-item";

  let {
    type = "button",
    variant = "default",
    active = false,
    disabled = false,
    className = "",
    id = undefined,
    element = $bindable<HTMLButtonElement | null>(null),
    role = undefined,
    ariaLabel = undefined,
    ariaPressed = undefined,
    ariaHaspopup = undefined,
    ariaExpanded = undefined,
    handlePress = undefined,
    handleKeyPress = undefined,
    handleMouseDown = undefined,
    blurOnPress = false,
    children,
  }: {
    type?: "button" | "submit" | "reset";
    variant?: ButtonVariant | ButtonVariant[];
    active?: boolean;
    disabled?: boolean;
    className?: string;
    id?: string | undefined;
    element?: HTMLButtonElement | null;
    role?: string | undefined;
    ariaLabel?: AriaAttributes["aria-label"];
    ariaPressed?: AriaAttributes["aria-pressed"];
    ariaHaspopup?: AriaAttributes["aria-haspopup"];
    ariaExpanded?: AriaAttributes["aria-expanded"];
    handlePress?: (() => void) | undefined;
    handleKeyPress?: ((event: KeyboardEvent) => void) | undefined;
    handleMouseDown?: ((event: MouseEvent) => void) | undefined;
    blurOnPress?: boolean;
    children?: Snippet;
  } = $props();

  const variantClass = (v: ButtonVariant) => v === "default" ? "button" : `button-${v}`;

  const classes = $derived([
    "button",
    (Array.isArray(variant) ? variant : [variant]).map(variantClass).join(" "),
    active ? "button-active" : "",
    className,
  ]
    .filter(Boolean)
    .join(" "));
</script>

<button
  bind:this={element}
  {type}
  {id}
  {role}
  class={classes}
  {disabled}
  aria-label={ariaLabel}
  aria-pressed={ariaPressed}
  aria-haspopup={ariaHaspopup}
  aria-expanded={ariaExpanded}
  onmousedown={(event) => handleMouseDown?.(event)}
  onclick={(event) => {
    if (blurOnPress && event.currentTarget instanceof HTMLButtonElement) {
      event.currentTarget.blur();
    }
    handlePress?.();
  }}
  onkeydown={(event) => handleKeyPress?.(event)}
>
  {@render children?.()}
</button>

<style>
  .button {
    border: 1px solid var(--color-line);
    background: var(--color-panel);
    border-radius: 8px;
    padding: 6px 11px;
    font-size: 12px;
    color: var(--color-text);
    cursor: pointer;
    transition: 120ms ease;
  }

  .button:hover {
    border-color: var(--color-accent);
    transform: translateY(-1px);
  }

  .button:disabled,
  .button:disabled:hover {
    opacity: 0.45;
    cursor: not-allowed;
    border-color: var(--color-line);
    transform: none;
  }

  .button-secondary {
    color: var(--color-muted);
  }

  .button-submit {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 700;
  }

  .button-destructive {
    background: transparent;
    color: var(--color-danger-text);
  }

  .button-small {
    font-size: 10px;
    padding: 3px 7px;
  }

  .button-menu-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    padding: 4px 8px;
    font-size: 16px;
    line-height: 1;
    color: var(--color-text-strong);
  }

  .button-menu-trigger[aria-expanded="true"] {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-panel), var(--color-accent) 12%);
  }

  .button-menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    border: none;
    border-radius: 8px;
    background: transparent;
    padding: 8px 10px;
    font-size: 12px;
    color: var(--color-text);
  }

  .button-menu-item:hover,
  .button-menu-item:active {
    transform: none;
  }

  .button-menu-item:hover {
    background: color-mix(
      in srgb,
      var(--color-panel-2),
      var(--color-accent) 16%
    );
  }

  .button-menu-item:active {
    background: color-mix(
      in srgb,
      var(--color-panel-2),
      var(--color-accent) 24%
    );
  }

  .button-menu-item:focus-visible {
    outline: 1px solid var(--color-accent);
    outline-offset: 1px;
  }

  .button-active {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 700;
  }
</style>
