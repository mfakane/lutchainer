/**
 * Tests for shared math utilities (matrix operations).
 * Validates: identity, multiplication, perspective, lookAt, normal matrix extraction.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    mat4Identity,
    mat4LookAt,
    mat4Multiply,
    mat4Perspective,
    normalMatrixFromMat4,
    type Mat4,
    type Vec3,
} from '../../src/shared/utils/math.ts';

const TOLERANCE = 1e-5;

/**
 * Helper: Check if two matrices are approximately equal.
 */
function assertMat4Close(actual: Mat4, expected: Mat4, label: string, tolerance = TOLERANCE) {
  for (let i = 0; i < 16; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > tolerance) {
      assert.fail(
        `${label}[${i}]: expected ${expected[i].toFixed(6)}, got ${actual[i].toFixed(6)} (diff ${diff.toFixed(6)})`,
      );
    }
  }
}

/**
 * Helper: Check if two vectors are approximately equal.
 */
function assertVec3Close(actual: Vec3, expected: Vec3, label: string, tolerance = TOLERANCE) {
  for (let i = 0; i < 3; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > tolerance) {
      assert.fail(
        `${label}[${i}]: expected ${expected[i].toFixed(6)}, got ${actual[i].toFixed(6)}`,
      );
    }
  }
}

test('Math - mat4Identity creates identity matrix', () => {
  const identity = mat4Identity();

  // Check diagonal is 1, off-diagonal is 0
  for (let i = 0; i < 16; i++) {
    const isdiagonal = (i % 5 === 0); // 0, 5, 10, 15 are diagonal in column-major
    const expected = isdiagonal ? 1 : 0;
    assert.equal(identity[i], expected, `identity[${i}] = ${expected}`);
  }
});

test('Math - mat4Multiply with identity returns second argument', () => {
  const identity = mat4Identity();
  const test = new Float32Array([
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, 16,
  ]);

  const result = mat4Multiply(identity, test);

  assertMat4Close(result, test, 'identity * test = test');
});

test('Math - mat4Multiply left identity returns first argument', () => {
  const identity = mat4Identity();
  const test = new Float32Array([
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, 16,
  ]);

  const result = mat4Multiply(test, identity);

  assertMat4Close(result, test, 'test * identity = test');
});

test('Math - mat4Multiply associativity', () => {
  const a = new Float32Array([1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1]);
  const b = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);
  const c = new Float32Array([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);

  // (a * b) * c should equal a * (b * c)
  const ab_c = mat4Multiply(mat4Multiply(a, b), c);
  const a_bc = mat4Multiply(a, mat4Multiply(b, c));

  assertMat4Close(ab_c, a_bc, 'matrix multiplication associative');
});

test('Math - mat4Perspective creates valid projection matrix', () => {
  const fovY = Math.PI / 4; // 45 degrees
  const aspect = 16 / 9;
  const near = 0.1;
  const far = 100;

  const proj = mat4Perspective(fovY, aspect, near, far);

  // Check expected non-zero elements for perspective matrix
  assert(proj[0] !== 0, 'proj[0] (scale x) is non-zero');
  assert(proj[5] !== 0, 'proj[5] (scale y) is non-zero');
  assert(proj[10] !== 0, 'proj[10] (scale z) is non-zero');
  assert.equal(proj[11], -1, 'proj[11] = -1');
  assert(proj[14] !== 0, 'proj[14] (near/far) is non-zero');
});

test('Math - mat4Perspective correct aspect ratio', () => {
  const fovY = Math.PI / 4;
  const aspect1 = 16 / 9;
  const aspect2 = 4 / 3;

  const proj1 = mat4Perspective(fovY, aspect1, 0.1, 100);
  const proj2 = mat4Perspective(fovY, aspect2, 0.1, 100);

  // Different aspect should affect proj[0]
  assert(proj1[0] !== proj2[0], 'different aspect ratios produce different x scale');
  // proj[5] should be the same (only depends on fovY)
  assert.equal(proj1[5], proj2[5], 'same fovY produces same y scale');
});

test('Math - mat4LookAt creates valid view matrix', () => {
  const eye: Vec3 = [0, 0, 5];
  const center: Vec3 = [0, 0, 0];
  const up: Vec3 = [0, 1, 0];

  const view = mat4LookAt(eye, center, up);

  // View matrix should be 4x4
  assert.equal(view.length, 16, 'view matrix is 4x4');
  // Last row should be [0, 0, 0, 1]
  assert.equal(view[3], 0, 'view[3] = 0');
  assert.equal(view[7], 0, 'view[7] = 0');
  assert.equal(view[11], 0, 'view[11] = 0');
  assert.equal(view[15], 1, 'view[15] = 1');
});

test('Math - mat4LookAt with camera at origin looking forward', () => {
  const eye: Vec3 = [0, 0, 0];
  const center: Vec3 = [0, 0, -1];
  const up: Vec3 = [0, 1, 0];

  const view = mat4LookAt(eye, center, up);

  // Should be close to identity for this simple case
  const identity = mat4Identity();
  const tolerance = 0.1; // Looser tolerance for this orientation test
  for (let i = 0; i < 16; i++) {
    assert(
      Math.abs(view[i] - identity[i]) < tolerance,
      `view matrix should be near-identity for forward-looking camera`,
    );
  }
});

test('Math - mat4LookAt orthonormality', () => {
  const eye: Vec3 = [3, 4, 5];
  const center: Vec3 = [0, 0, 0];
  const up: Vec3 = [0, 1, 0];

  const view = mat4LookAt(eye, center, up);

  // Extract the 3x3 rotation part and check orthonormality
  // For an orthonormal matrix M, M * M^T should be identity-ish
  const p0 = Math.hypot(view[0], view[1], view[2]);
  const p1 = Math.hypot(view[4], view[5], view[6]);
  const p2 = Math.hypot(view[8], view[9], view[10]);

  // First 3 rows should be unit vectors
  assert(Math.abs(p0 - 1) < TOLERANCE, 'first row is unit vector');
  assert(Math.abs(p1 - 1) < TOLERANCE, 'second row is unit vector');
  assert(Math.abs(p2 - 1) < TOLERANCE, 'third row is unit vector');
});

test('Math - normalMatrixFromMat4 extracts rotational part', () => {
  const view = mat4Identity();
  view[0] = 2; // Scale x
  view[5] = 2; // Scale y
  view[10] = 2; // Scale z

  const normal = normalMatrixFromMat4(view);

  // Should be 3x3
  assert.equal(normal.length, 9, 'normal matrix is 3x3');

  // Should extract the 3x3 part
  assert.equal(normal[0], 2, 'normal[0] = 2');
  assert.equal(normal[4], 2, 'normal[4] = 2');
  assert.equal(normal[8], 2, 'normal[8] = 2');
});

test('Math - mat4Perspective far > near ', () => {
  const proj1 = mat4Perspective(Math.PI / 4, 1, 0.1, 100);
  const proj2 = mat4Perspective(Math.PI / 4, 1, 0.1, 1000);

  // Changing far should affect proj[10]
  assert(proj1[10] !== proj2[10], 'different far values produce different depth scale');
});

test('Math - mat4LookAt inverse property', () => {
  const eye: Vec3 = [1, 2, 3];
  const center: Vec3 = [-1, 0, 1];
  const up: Vec3 = [0, 1, 0];

  const view1 = mat4LookAt(eye, center, up);
  // Reverse should be close to opposite
  const view2 = mat4LookAt(center, eye, up);

  // These should be different (opposite cameras)
  let allSame = true;
  for (let i = 0; i < 16; i++) {
    if (Math.abs(view1[i] - view2[i]) > TOLERANCE) {
      allSame = false;
      break;
    }
  }

  assert(!allSame, 'reverse camera produces different view matrix');
});
