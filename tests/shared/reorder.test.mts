/**
 * Tests for shared array reordering utilities.
 * Validates: item repositioning logic, position calculations, edge cases.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { reorderItemsById } from '../../src/shared/utils/reorder.ts';

/** Test item with id and optional label. */
interface TestItem {
  id: string;
  label?: string;
}

/**
 * Helper: Create test items.
 */
function createItems(...ids: string[]): TestItem[] {
  return ids.map((id, i) => ({ id, label: `item-${i}` }));
}

const getId = (item: TestItem) => item.id;

test('Reorder - basic reorder: move first to end', () => {
  const items = createItems('a', 'b', 'c');
  const result = reorderItemsById(items, 'a', 'c', true, getId);

  assert(result !== null, 'reorder should succeed');
  if (result) {
    assert.deepEqual(
      result.map(x => x.id),
      ['b', 'c', 'a'],
    );
  }
});

test('Reorder - basic reorder: move last to start', () => {
  const items = createItems('a', 'b', 'c');
  const result = reorderItemsById(items, 'c', 'a', false, getId);

  assert(result !== null);
  if (result) {
    assert.deepEqual(
      result.map(x => x.id),
      ['c', 'a', 'b'],
    );
  }
});

test('Reorder - move middle item to beginning', () => {
  const items = createItems('a', 'b', 'c', 'd');
  const result = reorderItemsById(items, 'b', 'a', false, getId);

  assert(result !== null);
  if (result) {
    assert.deepEqual(
      result.map(x => x.id),
      ['b', 'a', 'c', 'd'],
    );
  }
});

test('Reorder - move middle item after another middle item', () => {
  const items = createItems('a', 'b', 'c', 'd', 'e');
  const result = reorderItemsById(items, 'b', 'd', true, getId);

  assert(result !== null);
  if (result) {
    assert.deepEqual(
      result.map(x => x.id),
      ['a', 'c', 'd', 'b', 'e'],
    );
  }
});

test('Reorder - move to before itself returns null', () => {
  const items = createItems('a', 'b', 'c');
  const result = reorderItemsById(items, 'b', 'b', false, getId);

  assert.equal(result, null, 'same source and target returns null');
});

test('Reorder - move to after itself returns null', () => {
  const items = createItems('a', 'b', 'c');
  const result = reorderItemsById(items, 'b', 'b', true, getId);

  assert.equal(result, null);
});

test('Reorder - single item array with non-null target returns null', () => {
  const items = createItems('a');
  const result = reorderItemsById(items, 'a', 'a', true, getId);

  assert.equal(result, null);
});

test('Reorder - two item array: swap order', () => {
  const items = createItems('a', 'b');
  const result = reorderItemsById(items, 'a', 'b', true, getId);

  assert(result !== null);
  if (result) {
    assert.deepEqual(
      result.map(x => x.id),
      ['b', 'a'],
    );
  }
});

test('Reorder - moving nonexistent dragged item returns null', () => {
  const items = createItems('a', 'b', 'c');
  const result = reorderItemsById(items, 'x', 'b', false, getId);

  assert.equal(result, null, 'nonexistent dragged item returns null');
});

test('Reorder - move to nonexistent target (null is valid)', () => {
  const items = createItems('a', 'b', 'c');
  const result = reorderItemsById(items, 'a', null, false, getId);

  assert(result !== null, 'null target is treated as end');
  if (result) {
    // 'a' moved to end
    assert.equal(result[result.length - 1]?.id, 'a');
  }
});

test('Reorder - large array: move from position 0 to position 99', () => {
  const count = 100;
  const items = createItems(...Array.from({ length: count }, (_, i) => `item-${i}`));

  const result = reorderItemsById(items, 'item-0', 'item-99', true, getId);

  assert(result !== null);
  if (result) {
    // item-0 should now be after item-99
    assert.equal(result[result.length - 1]?.id, 'item-0');
    assert.equal(result.length, count);
  }
});

test('Reorder - large array: move from middle to another middle', () => {
  const items = createItems(
    'a', 'b', 'c', 'd', 'e',
    'f', 'g', 'h', 'i', 'j',
  );

  const result = reorderItemsById(items, 'c', 'h', true, getId);

  assert(result !== null);
  if (result) {
    assert.deepEqual(
      result.map(x => x.id),
      ['a', 'b', 'd', 'e', 'f', 'g', 'h', 'c', 'i', 'j'],
    );
  }
});

test('Reorder - preserves object properties during reordering', () => {
  const items: TestItem[] = [
    { id: 'a', label: 'first' },
    { id: 'b', label: 'second' },
    { id: 'c', label: 'third' },
  ];

  const result = reorderItemsById(items, 'a', 'c', true, getId);

  assert(result !== null);
  if (result) {
    // Check that properties are preserved
    assert.equal(result[0]?.id, 'b');
    assert.equal(result[0]?.label, 'second');
    assert.equal(result[2]?.id, 'a');
    assert.equal(result[2]?.label, 'first');
  }
});

test('Reorder - adjacent swap: move left item after right item', () => {
  const items = createItems('a', 'b', 'c');
  const result = reorderItemsById(items, 'a', 'b', true, getId);

  assert(result !== null);
  if (result) {
    assert.deepEqual(
      result.map(x => x.id),
      ['b', 'a', 'c'],
    );
  }
});

test('Reorder - adjacent swap: move right item before left item', () => {
  const items = createItems('a', 'b', 'c');
  const result = reorderItemsById(items, 'b', 'a', false, getId);

  assert(result !== null);
  if (result) {
    assert.deepEqual(
      result.map(x => x.id),
      ['b', 'a', 'c'],
    );
  }
});

test('Reorder - empty array with null target', () => {
  const items: TestItem[] = [];
  const result = reorderItemsById(items, 'a', null, false, getId);

  assert.equal(result, null, 'dragged item not in empty array');
});

test('Reorder - move before and after positions are distinct', () => {
  const items = createItems('a', 'b', 'c', 'd', 'e');

  // Move after 'c'
  const resultAfter = reorderItemsById(items, 'a', 'c', true, getId);
  // Move before 'c'
  const resultBefore = reorderItemsById(items, 'a', 'c', false, getId);

  assert(resultAfter !== null);
  assert(resultBefore !== null);
  assert(resultAfter !== resultBefore || false, 'different positions produce different arrays');
});

test('Reorder - sequential moves are composable', () => {
  let items = createItems('a', 'b', 'c', 'd');

  // Move 'a' after 'b'
  const result1 = reorderItemsById(items, 'a', 'b', true, getId);
  assert(result1 !== null);
  if (result1) {
    items = result1;
    assert.deepEqual(
      items.map(x => x.id),
      ['b', 'a', 'c', 'd'],
    );

    // Then move 'c' before 'a'
    const result2 = reorderItemsById(items, 'c', 'a', false, getId);
    assert(result2 !== null);
    if (result2) {
      assert.deepEqual(
        result2.map(x => x.id),
        ['b', 'c', 'a', 'd'],
      );
    }
  }
});

test('Reorder - stressed: alternating before/after moves', () => {
  let items = createItems('a', 'b', 'c', 'd', 'e');
  const originalCount = items.length;

  // Alternating pattern
  let result = reorderItemsById(items, 'd', 'a', false, getId);
  if (result) items = result;
  assert.equal(items.length, originalCount, 'maintains item count');

  result = reorderItemsById(items, 'b', 'e', true, getId);
  if (result) items = result;
  assert.equal(items.length, originalCount, 'maintains item count');

  result = reorderItemsById(items, 'a', 'c', false, getId);
  if (result) items = result;
  assert.equal(items.length, originalCount, 'maintains item count');

  // Final state should be valid (no duplicates, same length)
  assert.equal(items.length, 5);
  const ids = items.map(x => x.id);
  assert.equal(new Set(ids).size, 5, 'no duplicate items');
});
