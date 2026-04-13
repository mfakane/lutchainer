export interface PointerSessionManager {
  beginPointerSession: (onMove: (event: PointerEvent) => void, onEnd: () => void) => void;
  cleanupPointerSession: () => void;
}

interface PointerSessionManagerOptions {
  documentTarget?: Document;
}

export function createPointerSessionManager(
  options: PointerSessionManagerOptions = {},
): PointerSessionManager {
  const documentTarget = options.documentTarget ?? document;
  let activePointerSessionCleanup: (() => void) | null = null;

  const cleanupPointerSession = (): void => {
    if (!activePointerSessionCleanup) {
      return;
    }
    activePointerSessionCleanup();
    activePointerSessionCleanup = null;
  };

  const beginPointerSession = (
    onMove: (event: PointerEvent) => void,
    onEnd: () => void,
  ): void => {
    cleanupPointerSession();

    const handleMove = (event: PointerEvent): void => {
      onMove(event);
    };

    const finishSession = (): void => {
      cleanupPointerSession();
      onEnd();
    };

    documentTarget.addEventListener('pointermove', handleMove);
    documentTarget.addEventListener('pointerup', finishSession);
    documentTarget.addEventListener('pointercancel', finishSession);

    activePointerSessionCleanup = () => {
      documentTarget.removeEventListener('pointermove', handleMove);
      documentTarget.removeEventListener('pointerup', finishSession);
      documentTarget.removeEventListener('pointercancel', finishSession);
    };
  };

  return {
    beginPointerSession,
    cleanupPointerSession,
  };
}
