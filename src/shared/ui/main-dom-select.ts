export type MainDomSelector = <T extends Element>(selector: string) => T;

function ensureSelector(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('DOM selector must be a non-empty string.');
  }
}

function ensureQueryRoot(value: unknown): asserts value is ParentNode {
  if (!value || typeof value !== 'object' || typeof (value as ParentNode).querySelector !== 'function') {
    throw new Error('DOM query root must support querySelector.');
  }
}

export function createRequiredDomSelector(root: ParentNode = document): MainDomSelector {
  ensureQueryRoot(root);

  return <T extends Element>(selector: string): T => {
    ensureSelector(selector);

    const element = root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Required DOM element was not found: ${selector}`);
    }
    return element;
  };
}