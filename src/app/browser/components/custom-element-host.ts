export interface SvelteHostElement<Props extends Record<string, unknown>> extends HTMLElement {
  setHostProps: (props: Partial<Props>) => void;
  destroyHost: () => void;
}

function upgradeHostElement(host: HTMLElement, tagName: string): void {
  if (typeof customElements === 'undefined') {
    return;
  }

  const definition = customElements.get(tagName);
  if (!definition) {
    return;
  }

  customElements.upgrade(host);
}

function setElementProp(host: HTMLElement, key: string, value: unknown): void {
  const record = host as unknown as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(host, key)) {
    delete record[key];
  }
  record[key] = value;
}

function applyHostProps<Props extends Record<string, unknown>>(host: HTMLElement, props: Partial<Props>): void {
  for (const [key, value] of Object.entries(props)) {
    setElementProp(host, key, value);
  }
}

function scheduleHostPropsReplay<Props extends Record<string, unknown>>(
  host: HTMLElement,
  props: Partial<Props>,
): void {
  queueMicrotask(() => {
    applyHostProps(host, props);
  });
}

function ensureHostTarget<Props extends Record<string, unknown>>(
  target: HTMLElement,
  tagName: string,
): SvelteHostElement<Props> {
  if (target.tagName.toLowerCase() === tagName.toLowerCase()) {
    const element = target as SvelteHostElement<Props>;
    element.setHostProps ??= function setHostProps(props: Partial<Props>): void {
      applyHostProps(this, props);
      scheduleHostPropsReplay(this, props);
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
    applyHostProps(this, props);
    scheduleHostPropsReplay(this, props);
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
  upgradeHostElement(host, options.tagName);
  host.setHostProps(options.props);
  return host;
}
