/**
 * Tests for shared geometry utilities (mesh generation).
 * Validates: sphere, cube, torus geometry generation and properties.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createCube,
    createSphere,
    createTorus,
    type Geometry,
} from '../../src/shared/utils/geometry.ts';

/**
 * Helper: Verify basic geometry properties.
 */
function assertValidGeometry(geom: Geometry, label: string) {
  assert(geom.positions instanceof Float32Array, `${label}: positions is Float32Array`);
  assert(geom.normals instanceof Float32Array, `${label}: normals is Float32Array`);
  assert(geom.texcoords instanceof Float32Array, `${label}: texcoords is Float32Array`);
  assert(geom.indices instanceof Uint16Array, `${label}: indices is Uint16Array`);

  assert(geom.positions.length % 3 === 0, `${label}: positions length divisible by 3`);
  assert(geom.normals.length % 3 === 0, `${label}: normals length divisible by 3`);
  assert(geom.texcoords.length % 2 === 0, `${label}: texcoords length divisible by 2`);
}

/**
 * Helper: Check if all normals are unit length.
 */
function assertNormalsNormalized(normals: Float32Array, label: string, tolerance = 1e-5) {
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i]!;
    const y = normals[i + 1]!;
    const z = normals[i + 2]!;
    const len = Math.hypot(x, y, z);
    assert(
      Math.abs(len - 1) < tolerance || len < tolerance,
      `${label}: normal ${i / 3} should be unit length, got ${len.toFixed(6)}`,
    );
  }
}

/**
 * Helper: Check if all texcoords are in [0, 1].
 */
function assertTexcoordsNormalized(texcoords: Float32Array, label: string) {
  for (let i = 0; i < texcoords.length; i++) {
    const val = texcoords[i]!;
    assert(val >= 0 && val <= 1, `${label}: texcoord ${i} should be in [0, 1], got ${val}`);
  }
}

test('Geometry - createSphere with default parameters', () => {
  const geom = createSphere();

  assertValidGeometry(geom, 'sphere default');

  // Default: radius=1, latSegs=32, lonSegs=32
  // Total vertices: (32+1)*(32+1) = 1089
  const expectedVerts = (32 + 1) * (32 + 1);
  assert.equal(geom.positions.length / 3, expectedVerts, 'vertex count matches');
  assert.equal(geom.normals.length / 3, expectedVerts, 'normal count matches');
  assert.equal(geom.texcoords.length / 2, expectedVerts, 'texcoord count matches');
});

test('Geometry - createSphere with custom parameters', () => {
  const geom = createSphere(2.0, 16, 16);

  assertValidGeometry(geom, 'sphere custom');

  const expectedVerts = (16 + 1) * (16 + 1);
  assert.equal(geom.positions.length / 3, expectedVerts);
});

test('Geometry - createSphere radius affects positions', () => {
  const geom1 = createSphere(1.0, 2, 2);
  const geom2 = createSphere(2.0, 2, 2);

  // Max radius in geom2 should be ~2x larger
  let maxRadius1 = 0;
  for (let i = 0; i < geom1.positions.length; i += 3) {
    const dist = Math.hypot(
      geom1.positions[i]!,
      geom1.positions[i + 1]!,
      geom1.positions[i + 2]!,
    );
    maxRadius1 = Math.max(maxRadius1, dist);
  }

  let maxRadius2 = 0;
  for (let i = 0; i < geom2.positions.length; i += 3) {
    const dist = Math.hypot(
      geom2.positions[i]!,
      geom2.positions[i + 1]!,
      geom2.positions[i + 2]!,
    );
    maxRadius2 = Math.max(maxRadius2, dist);
  }

  assert(maxRadius2 > maxRadius1, 'larger radius produces larger sphere');
  assert(Math.abs(maxRadius2 / maxRadius1 - 2) < 0.1, 'radius scale is 2');
});

test('Geometry - createSphere normals are unit length', () => {
  const geom = createSphere();
  assertNormalsNormalized(geom.normals, 'sphere');
});

test('Geometry - createSphere texcoords in [0,1]', () => {
  const geom = createSphere();
  assertTexcoordsNormalized(geom.texcoords, 'sphere');
});

test('Geometry - createSphere has valid indices', () => {
  const geom = createSphere(1, 2, 2);

  // All indices should reference valid vertices
  const vertexCount = geom.positions.length / 3;
  for (let i = 0; i < geom.indices.length; i++) {
    const idx = geom.indices[i]!;
    assert(idx >= 0 && idx < vertexCount, `index ${i} is valid`);
  }
});

test('Geometry - createCube with default parameter', () => {
  const geom = createCube();

  assertValidGeometry(geom, 'cube default');

  // Cube: 6 faces * 4 vertices per face = 24 vertices
  assert.equal(geom.positions.length / 3, 24, '24 vertices in cube');
  // 6 faces * 2 triangles * 3 indices = 36 indices
  assert.equal(geom.indices.length, 36, '36 indices in cube');
});

test('Geometry - createCube with custom size', () => {
  const geom1 = createCube(1.0);
  const geom2 = createCube(2.0);

  // Structures should be the same, just scaled
  assert.equal(geom1.positions.length, geom2.positions.length);
  assert.equal(geom1.indices.length, geom2.indices.length);
});

test('Geometry - createCube normals are unit length', () => {
  const geom = createCube();
  assertNormalsNormalized(geom.normals, 'cube');
});

test('Geometry - createCube normals point outward', () => {
  const geom = createCube(2.0);

  // Each normal should point outward (dot product with position should be positive)
  for (let i = 0; i < geom.positions.length; i += 3) {
    const px = geom.positions[i]!;
    const py = geom.positions[i + 1]!;
    const pz = geom.positions[i + 2]!;

    const nx = geom.normals[i]!;
    const ny = geom.normals[i + 1]!;
    const nz = geom.normals[i + 2]!;

    const dot = px * nx + py * ny + pz * nz;
    assert(dot > 0 || Math.abs(dot) < 1e-5, `normal ${i / 3} points outward`);
  }
});

test('Geometry - createCube texcoords in [0,1]', () => {
  const geom = createCube();
  assertTexcoordsNormalized(geom.texcoords, 'cube');
});

test('Geometry - createTorus with default parameters', () => {
  const geom = createTorus();

  assertValidGeometry(geom, 'torus default');

  // Default: majorSegs=48, minorSegs=24
  const expectedVerts = (48 + 1) * (24 + 1);
  assert.equal(geom.positions.length / 3, expectedVerts);
});

test('Geometry - createTorus with custom parameters', () => {
  const geom = createTorus(1.0, 0.25, 16, 8);

  assertValidGeometry(geom, 'torus custom');

  const expectedVerts = (16 + 1) * (8 + 1);
  assert.equal(geom.positions.length / 3, expectedVerts);
});

test('Geometry - createTorus normals are unit length', () => {
  const geom = createTorus();
  assertNormalsNormalized(geom.normals, 'torus');
});

test('Geometry - createTorus texcoords in [0,1]', () => {
  const geom = createTorus();
  assertTexcoordsNormalized(geom.texcoords, 'torus');
});

test('Geometry - createTorus major radius affects size', () => {
  const geom1 = createTorus(0.5, 0.1, 8, 8);
  const geom2 = createTorus(1.0, 0.1, 8, 8);

  // Find max distance from center
  let maxDist1 = 0;
  for (let i = 0; i < geom1.positions.length; i += 3) {
    const x = geom1.positions[i]!;
    const z = geom1.positions[i + 2]!;
    const dist = Math.hypot(x, z);
    maxDist1 = Math.max(maxDist1, dist);
  }

  let maxDist2 = 0;
  for (let i = 0; i < geom2.positions.length; i += 3) {
    const x = geom2.positions[i]!;
    const z = geom2.positions[i + 2]!;
    const dist = Math.hypot(x, z);
    maxDist2 = Math.max(maxDist2, dist);
  }

  // Larger major radius should produce larger torus
  assert(maxDist2 > maxDist1, 'larger majorR produces larger torus');
});

test('Geometry - createTorus minor radius affects thickness', () => {
  const geom1 = createTorus(1.0, 0.1, 8, 8);
  const geom2 = createTorus(1.0, 0.3, 8, 8);

  // Collect all y distances (minor circle direction)
  const yRanges1 = [Infinity, -Infinity];
  for (let i = 1; i < geom1.positions.length; i += 3) {
    const y = geom1.positions[i]!;
    yRanges1[0] = Math.min(yRanges1[0], y);
    yRanges1[1] = Math.max(yRanges1[1], y);
  }

  const yRanges2 = [Infinity, -Infinity];
  for (let i = 1; i < geom2.positions.length; i += 3) {
    const y = geom2.positions[i]!;
    yRanges2[0] = Math.min(yRanges2[0], y);
    yRanges2[1] = Math.max(yRanges2[1], y);
  }

  const height1 = yRanges1[1]! - yRanges1[0]!;
  const height2 = yRanges2[1]! - yRanges2[0]!;

  // Larger minor radius should produce thicker torus
  assert(height2 > height1, 'larger minorR produces thicker torus');
});

test('Geometry - all geometries have consistent vertex-face relationship', () => {
  const geometries = [
    createSphere(1, 4, 4),
    createCube(1),
    createTorus(1, 0.3, 8, 8),
  ];

  for (const geom of geometries) {
    // Every index should point to valid vertex
    const vertexCount = geom.positions.length / 3;
    for (const idx of geom.indices) {
      assert(idx >= 0 && idx < vertexCount, `index ${idx} valid for ${vertexCount} vertices`);
    }

    // Normal count should match position count
    assert.equal(
      geom.normals.length,
      geom.positions.length,
      'normals and positions same length',
    );

    // Texcoord count should be 2/3 of position count (2D UVs per 3D position)
    assert.equal(
      geom.texcoords.length * 1.5,
      geom.positions.length,
      'texcoords 2D, positions 3D',
    );
  }
});
