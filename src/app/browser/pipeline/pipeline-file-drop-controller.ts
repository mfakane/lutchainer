interface PipelineFileDropControllerOptions {
  overlayEl: HTMLElement;
  loadPipelineFile: (file: File) => Promise<void>;
  isPipelineFile: (file: File) => boolean;
}

export interface PipelineFileDropController {
  dispose: () => void;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function.`);
  }
}

function assertOptions(options: PipelineFileDropControllerOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Pipeline file drop controller options must be an object.');
  }

  if (!(options.overlayEl instanceof HTMLElement)) {
    throw new Error('Pipeline file drop overlay element must be an HTMLElement.');
  }

  ensureFunction(options.loadPipelineFile, 'Pipeline file drop controller loadPipelineFile');
  ensureFunction(options.isPipelineFile, 'Pipeline file drop controller isPipelineFile');
}

function isFileDrag(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false;
  }

  return Array.from(dataTransfer.types).includes('Files');
}

function hasSupportedDraggedFile(
  dataTransfer: DataTransfer | null,
  isPipelineFile: (file: File) => boolean,
): boolean {
  if (!dataTransfer || !isFileDrag(dataTransfer)) {
    return false;
  }

  const items = Array.from(dataTransfer.items);
  if (items.length === 0) {
    return true;
  }

  for (const item of items) {
    if (item.kind !== 'file') {
      continue;
    }

    const file = item.getAsFile();
    if (file === null) {
      return true;
    }

    if (isPipelineFile(file)) {
      return true;
    }
  }

  return false;
}

function resolveDroppedPipelineFile(
  dataTransfer: DataTransfer | null,
  isPipelineFile: (file: File) => boolean,
): File | null {
  if (!dataTransfer) {
    return null;
  }

  const files = Array.from(dataTransfer.files).filter((file): file is File => file instanceof File);
  if (files.length === 0) {
    return null;
  }

  const matched = files.find(file => isPipelineFile(file));
  return matched ?? files[0] ?? null;
}

function syncOverlayState(overlayEl: HTMLElement, active: boolean): void {
  overlayEl.dataset.active = active ? 'true' : 'false';
  overlayEl.setAttribute('aria-hidden', active ? 'false' : 'true');
}

export function createPipelineFileDropController(
  options: PipelineFileDropControllerOptions,
): PipelineFileDropController {
  assertOptions(options);

  let dragDepth = 0;

  const hideOverlay = (): void => {
    dragDepth = 0;
    syncOverlayState(options.overlayEl, false);
  };

  const showOverlay = (): void => {
    syncOverlayState(options.overlayEl, true);
  };

  const handleDragEnter = (event: DragEvent): void => {
    if (!hasSupportedDraggedFile(event.dataTransfer, options.isPipelineFile)) {
      return;
    }

    dragDepth += 1;
    event.preventDefault();
    showOverlay();
  };

  const handleDragOver = (event: DragEvent): void => {
    if (!hasSupportedDraggedFile(event.dataTransfer, options.isPipelineFile)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    showOverlay();
  };

  const handleDragLeave = (event: DragEvent): void => {
    if (!isFileDrag(event.dataTransfer)) {
      return;
    }

    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      syncOverlayState(options.overlayEl, false);
    }
  };

  const handleDrop = (event: DragEvent): void => {
    if (!isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    const file = resolveDroppedPipelineFile(event.dataTransfer, options.isPipelineFile);
    hideOverlay();

    if (!file) {
      return;
    }

    void options.loadPipelineFile(file);
  };

  window.addEventListener('dragenter', handleDragEnter);
  window.addEventListener('dragover', handleDragOver);
  window.addEventListener('dragleave', handleDragLeave);
  window.addEventListener('drop', handleDrop);
  window.addEventListener('blur', hideOverlay);

  syncOverlayState(options.overlayEl, false);

  return {
    dispose: () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('blur', hideOverlay);
      hideOverlay();
    },
  };
}
