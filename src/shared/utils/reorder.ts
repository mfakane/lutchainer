export function reorderItemsById<TItem, TId extends string | number>(
  items: TItem[],
  draggedId: TId,
  targetId: TId | null,
  after: boolean,
  getId: (item: TItem) => TId,
): TItem[] | null {
  if (!Array.isArray(items)) {
    throw new Error('並び替え対象が配列ではありません。');
  }
  if (typeof getId !== 'function') {
    throw new Error('並び替え識別子関数が不正です。');
  }
  if (typeof after !== 'boolean') {
    throw new Error(`after フラグが不正です: ${String(after)}`);
  }

  if (targetId === draggedId) {
    return null;
  }

  const draggedIndex = items.findIndex(item => getId(item) === draggedId);
  if (draggedIndex < 0) {
    return null;
  }

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(draggedIndex, 1);
  if (draggedItem === undefined) {
    return null;
  }

  let insertIndex = nextItems.length;
  if (targetId !== null) {
    const targetIndex = nextItems.findIndex(item => getId(item) === targetId);
    if (targetIndex >= 0) {
      insertIndex = targetIndex + (after ? 1 : 0);
    }
  }

  nextItems.splice(insertIndex, 0, draggedItem);

  let changed = false;
  for (let index = 0; index < nextItems.length; index++) {
    const current = items[index];
    if (!current || getId(nextItems[index]) !== getId(current)) {
      changed = true;
      break;
    }
  }

  return changed ? nextItems : null;
}
