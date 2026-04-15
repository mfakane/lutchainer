import { INTERNAL_REORDER_DRAG_MIME_TYPE } from '../interactions/dnd.ts';

interface PipelineFileDropControllerOptions {
  pipelineOverlayEl: HTMLElement;
  lutOverlayEl: HTMLElement;
  loadPipelineFile: (file: File) => Promise<void>;
  addLutFiles: (files: File[]) => Promise<void>;
  isPipelineFile: (file: File) => boolean;
  isInternalDragActive?: () => boolean;
}

export interface PipelineFileDropController {
  dispose: () => void;
}

type DragFileKind = 'pipeline' | 'lut-images' | null;

const IMAGE_FILE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'];

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function.`);
  }
}

function assertOptions(options: PipelineFileDropControllerOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Pipeline file drop controller options must be an object.');
  }

  if (!(options.pipelineOverlayEl instanceof HTMLElement)) {
    throw new Error('Pipeline file drop overlay element must be an HTMLElement.');
  }
  if (!(options.lutOverlayEl instanceof HTMLElement)) {
    throw new Error('LUT file drop overlay element must be an HTMLElement.');
  }

  ensureFunction(options.loadPipelineFile, 'Pipeline file drop controller loadPipelineFile');
  ensureFunction(options.addLutFiles, 'Pipeline file drop controller addLutFiles');
  ensureFunction(options.isPipelineFile, 'Pipeline file drop controller isPipelineFile');
  if (options.isInternalDragActive !== undefined) {
    ensureFunction(options.isInternalDragActive, 'Pipeline file drop controller isInternalDragActive');
  }
}

function isFileDrag(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false;
  }

  return Array.from(dataTransfer.types).includes('Files');
}

function isInternalReorderDrag(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false;
  }

  return Array.from(dataTransfer.types).includes(INTERNAL_REORDER_DRAG_MIME_TYPE);
}

function isImageFilename(filename: string | undefined): boolean {
  if (typeof filename !== 'string') {
    return false;
  }

  const lower = filename.trim().toLowerCase();
  return IMAGE_FILE_EXTENSIONS.some(extension => lower.endsWith(extension));
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || isImageFilename(file.name);
}

function resolveDraggedFileKind(
  dataTransfer: DataTransfer | null,
  isPipelineFile: (file: File) => boolean,
): DragFileKind {
  if (!dataTransfer || !isFileDrag(dataTransfer)) {
    return null;
  }

  const items = Array.from(dataTransfer.items);
  if (items.length > 0) {
    let hasImage = false;
    let hasUnknownFile = false;

    for (const item of items) {
      if (item.kind !== 'file') {
        continue;
      }

      const file = item.getAsFile();
      if (file !== null) {
        if (isPipelineFile(file)) {
          return 'pipeline';
        }
        if (isImageFile(file)) {
          hasImage = true;
        }
        hasUnknownFile = true;
        continue;
      }

      if (item.type.startsWith('image/')) {
        hasImage = true;
        continue;
      }

      // Dragging from the OS often reports kind=file while getAsFile() is still null.
      // In that state, image MIME types are usually available, but custom extensions like
      // .lutchain may surface as empty or unknown types. Treat non-image files as pipeline
      // candidates so the user still gets a valid drop target before drop.
      hasUnknownFile = true;
    }

    if (hasImage) {
      return 'lut-images';
    }
    if (hasUnknownFile) {
      return 'pipeline';
    }
    return null;
  }

  const files = Array.from(dataTransfer.files).filter((file): file is File => file instanceof File);
  if (files.some(file => isPipelineFile(file))) {
    return 'pipeline';
  }
  if (files.some(file => isImageFile(file))) {
    return 'lut-images';
  }
  return null;
}

function resolveDroppedPipelineFile(
  dataTransfer: DataTransfer | null,
  isPipelineFile: (file: File) => boolean,
): File | null {
  if (!dataTransfer) {
    return null;
  }

  const files = Array.from(dataTransfer.files).filter((file): file is File => file instanceof File);
  return files.find(file => isPipelineFile(file)) ?? null;
}

function resolveDroppedImageFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) {
    return [];
  }

  return Array.from(dataTransfer.files)
    .filter((file): file is File => file instanceof File)
    .filter(file => isImageFile(file));
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

  const hideOverlays = (): void => {
    dragDepth = 0;
    syncOverlayState(options.pipelineOverlayEl, false);
    syncOverlayState(options.lutOverlayEl, false);
  };

  const showOverlayForKind = (kind: DragFileKind): void => {
    syncOverlayState(options.pipelineOverlayEl, kind === 'pipeline');
    syncOverlayState(options.lutOverlayEl, kind === 'lut-images');
  };

  const shouldIgnoreDrag = (dataTransfer: DataTransfer | null): boolean =>
    isInternalReorderDrag(dataTransfer) || options.isInternalDragActive?.() === true;

  const handleDragEnter = (event: DragEvent): void => {
    if (shouldIgnoreDrag(event.dataTransfer)) {
      hideOverlays();
      return;
    }

    const kind = resolveDraggedFileKind(event.dataTransfer, options.isPipelineFile);
    if (kind === null) {
      return;
    }

    dragDepth += 1;
    event.preventDefault();
    showOverlayForKind(kind);
  };

  const handleDragOver = (event: DragEvent): void => {
    if (shouldIgnoreDrag(event.dataTransfer)) {
      hideOverlays();
      return;
    }

    const kind = resolveDraggedFileKind(event.dataTransfer, options.isPipelineFile);
    if (kind === null) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    showOverlayForKind(kind);
  };

  const handleDragLeave = (event: DragEvent): void => {
    if (shouldIgnoreDrag(event.dataTransfer)) {
      hideOverlays();
      return;
    }

    if (!isFileDrag(event.dataTransfer)) {
      return;
    }

    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      syncOverlayState(options.pipelineOverlayEl, false);
      syncOverlayState(options.lutOverlayEl, false);
    }
  };

  const handleDrop = (event: DragEvent): void => {
    if (shouldIgnoreDrag(event.dataTransfer)) {
      hideOverlays();
      return;
    }

    const kind = resolveDraggedFileKind(event.dataTransfer, options.isPipelineFile);
    if (kind === null) {
      return;
    }

    event.preventDefault();

    if (kind === 'pipeline') {
      const file = resolveDroppedPipelineFile(event.dataTransfer, options.isPipelineFile);
      hideOverlays();
      if (!file) {
        return;
      }
      void options.loadPipelineFile(file);
      return;
    }

    const imageFiles = resolveDroppedImageFiles(event.dataTransfer);
    hideOverlays();
    if (imageFiles.length === 0) {
      return;
    }
    void options.addLutFiles(imageFiles);
  };

  window.addEventListener('dragenter', handleDragEnter);
  window.addEventListener('dragover', handleDragOver);
  window.addEventListener('dragleave', handleDragLeave);
  window.addEventListener('drop', handleDrop);
  window.addEventListener('blur', hideOverlays);

  hideOverlays();

  return {
    dispose: () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('blur', hideOverlays);
      hideOverlays();
    },
  };
}
