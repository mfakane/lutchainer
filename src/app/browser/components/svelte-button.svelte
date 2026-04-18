<script lang="ts">
  import type { AriaAttributes } from "svelte/elements";

  type ButtonVariant =
    | "default"
    | "secondary"
    | "submit"
    | "destructive"
    | "small"
    | "menu-trigger"
    | "menu-item";

  export let type: "button" | "submit" | "reset" = "button";
  export let variant: ButtonVariant | ButtonVariant[] = "default";
  export let active = false;
  export let disabled = false;
  export let className = "";
  export let id: string | undefined = undefined;
  export let element: HTMLButtonElement | null = null;
  export let role: string | undefined = undefined;
  export let ariaLabel: AriaAttributes["aria-label"] = undefined;
  export let ariaPressed: AriaAttributes["aria-pressed"] = undefined;
  export let ariaHaspopup: AriaAttributes["aria-haspopup"] = undefined;
  export let ariaExpanded: AriaAttributes["aria-expanded"] = undefined;
  export let handlePress: (() => void) | undefined = undefined;
  export let handleKeyPress: ((event: KeyboardEvent) => void) | undefined =
    undefined;
  export let handleMouseDown: ((event: MouseEvent) => void) | undefined =
    undefined;
  export let blurOnPress = false;

  const variantClass = (v: ButtonVariant) => v === "default" ? "button" : `button-${v}`;

  $: classes = [
    "button",
    (Array.isArray(variant) ? variant : [variant]).map(variantClass).join(" "),
    active ? "button-active" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
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
  on:mousedown={(event) => handleMouseDown?.(event)}
  on:click={(event) => {
    if (blurOnPress && event.currentTarget instanceof HTMLButtonElement) {
      event.currentTarget.blur();
    }
    handlePress?.();
  }}
  on:keydown={(event) => handleKeyPress?.(event)}
>
  <slot />
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
