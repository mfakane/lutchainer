export interface SvelteHostElement<Props extends Record<string, unknown>> extends HTMLElement {
  setHostProps: (props: Partial<Props>) => void;
  destroyHost: () => void;
}

function ensureHostTarget<Props extends Record<string, unknown>>(
  target: HTMLElement,
  tagName: string,
): SvelteHostElement<Props> {
  if (target.tagName.toLowerCase() === tagName.toLowerCase()) {
    const element = target as SvelteHostElement<Props>;
    element.setHostProps ??= function setHostProps(props: Partial<Props>): void {
      Object.assign(this, props);
    };
    element.destroyHost ??= () => undefined;
    return element;
  }

  const replacement = document.createElement(tagName) as SvelteHostElement<Props>;
  for (const attribute of Array.from(target.attributes)) {
    replacement.setAttribute(attribute.name, attribute.value);
  }

  replacement.className = target.className;
  replacement.setHostProps = function setHostProps(props: Partial<Props>): void {
    Object.assign(this, props);
  };
  replacement.destroyHost = () => undefined;
  target.replaceWith(replacement);
  return replacement;
}

export function mountSvelteHost<Props extends Record<string, unknown>>(options: {
  tagName: string;
  target: HTMLElement;
  props: Props;
}): SvelteHostElement<Props> {
  const host = ensureHostTarget(options.target, options.tagName);
  host.setHostProps(options.props);
  return host;
}
