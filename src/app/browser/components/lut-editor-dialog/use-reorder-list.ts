import { getLinearDropPlacement, type LinearDropCandidate } from '../../interactions/dnd.ts';

export interface ReorderListItem<TId extends string> {
  id: TId;
}

export interface CreatePointerReorderListOptions<TId extends string> {
  beginPointerSession: (onMove: (event: PointerEvent) => void, onEnd: () => void) => void;
  getItems: () => readonly ReorderListItem<TId>[];
  queryCandidateElements: () => HTMLElement[];
  getElementItemId: (element: HTMLElement) => TId | null;
  getPointerCoord: (event: PointerEvent) => number;
  setDraggingIndex: (index: number | null) => void;
  setDropTarget: (targetId: TId | null, after: boolean) => void;
  commitMove: (fromIndex: number, insertBeforeIndex: number) => void;
  moveThreshold?: number;
}

export interface PointerReorderListController<TId extends string> {
  startDrag: (itemIndex: number, event: PointerEvent) => void;
  shouldSuppressClick: () => boolean;
}

export function syncReorderDropIndicators<TId extends string>(options: {
  elements: HTMLElement[];
  getElementItemId: (element: HTMLElement) => TId | null;
  dropTargetId: TId | null;
  dropAfter: boolean;
}): void {
  for (const element of options.elements) {
    const itemId = options.getElementItemId(element);
    if (itemId && itemId === options.dropTargetId) {
      element.dataset.dropPosition = options.dropAfter ? 'after' : 'before';
    } else {
      delete element.dataset.dropPosition;
    }
  }
}

export function createPointerReorderListController<TId extends string>(
  options: CreatePointerReorderListOptions<TId>,
): PointerReorderListController<TId> {
  let suppressClick = false;
  let lastDropTargetId: TId | null = null;
  let lastDropAfter = false;
  const moveThreshold = options.moveThreshold ?? 4;

  function startDrag(itemIndex: number, event: PointerEvent): void {
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;
    suppressClick = false;

    const onMove = (moveEvent: PointerEvent): void => {
      if (!dragStarted) {
        if (Math.abs(moveEvent.clientX - startX) < moveThreshold && Math.abs(moveEvent.clientY - startY) < moveThreshold) {
          return;
        }
        dragStarted = true;
        suppressClick = true;
        moveEvent.preventDefault();
        options.setDraggingIndex(itemIndex);
        lastDropTargetId = null;
        lastDropAfter = false;
        options.setDropTarget(null, false);
      }

      const items = options.getItems();
      const draggedItem = items[itemIndex];
      if (!draggedItem) {
        return;
      }

      const dragCandidates: LinearDropCandidate<TId>[] = options.queryCandidateElements().flatMap(element => {
        const itemId = options.getElementItemId(element);
        if (!itemId || itemId === draggedItem.id) {
          return [];
        }
        const rect = element.getBoundingClientRect();
        return [{ id: itemId, midpoint: rect.top + rect.height * 0.5 }];
      });

      const placement = getLinearDropPlacement(dragCandidates, options.getPointerCoord(moveEvent));
      lastDropTargetId = placement.targetId;
      lastDropAfter = placement.after;
      options.setDropTarget(placement.targetId, placement.after);
    };

    const onEnd = (): void => {
      const items = options.getItems();
      if (dragStarted) {
        const draggedItem = items[itemIndex];
        if (draggedItem) {
          const insertBeforeIndex = (() => {
            if (!lastDropTargetId) {
              return items.length;
            }
            const targetIndex = items.findIndex(item => item.id === lastDropTargetId);
            if (targetIndex < 0) {
              return items.length;
            }
            return lastDropAfter ? targetIndex + 1 : targetIndex;
          })();
          options.commitMove(itemIndex, insertBeforeIndex);
        }
      }
      options.setDraggingIndex(null);
      options.setDropTarget(null, false);
      lastDropTargetId = null;
      lastDropAfter = false;
    };

    options.beginPointerSession(onMove, onEnd);
  }

  function shouldSuppressClick(): boolean {
    const value = suppressClick;
    suppressClick = false;
    return value;
  }

  return {
    startDrag,
    shouldSuppressClick,
  };
}
