export interface Geometry {
  positions: Float32Array;
  normals: Float32Array;
  texcoords: Float32Array;
  indices: Uint16Array;
}

/** UV sphere */
export function createSphere(radius = 1.0, latSegs = 32, lonSegs = 32): Geometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const texcoords: number[] = [];
  const indices: number[] = [];

  for (let lat = 0; lat <= latSegs; lat++) {
    const theta = (lat / latSegs) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    for (let lon = 0; lon <= lonSegs; lon++) {
      const phi = (lon / lonSegs) * Math.PI * 2;
      const x = Math.cos(phi) * sinT;
      const y = cosT;
      const z = Math.sin(phi) * sinT;
      positions.push(radius * x, radius * y, radius * z);
      normals.push(x, y, z);
      texcoords.push(lon / lonSegs, lat / latSegs);
    }
  }

  for (let lat = 0; lat < latSegs; lat++) {
    for (let lon = 0; lon < lonSegs; lon++) {
      const a = lat * (lonSegs + 1) + lon;
      const b = a + lonSegs + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    texcoords: new Float32Array(texcoords),
    indices: new Uint16Array(indices),
  };
}

/** Axis-aligned cube */
export function createCube(size = 1.0): Geometry {
  const h = size / 2;
  type FaceDef = { verts: [number, number, number][]; normal: [number, number, number] };

  const faces: FaceDef[] = [
    { verts: [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]],     normal: [0, 0, 1]  },
    { verts: [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]], normal: [0, 0, -1] },
    { verts: [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]], normal: [-1, 0, 0] },
    { verts: [[h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h]],     normal: [1, 0, 0]  },
    { verts: [[-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h]],     normal: [0, 1, 0]  },
    { verts: [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]], normal: [0, -1, 0] },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const texcoords: number[] = [];
  const indices: number[] = [];
  const faceUVs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

  faces.forEach((face, fi) => {
    const base = fi * 4;
    face.verts.forEach((v, vi) => {
      positions.push(...v);
      normals.push(...face.normal);
      texcoords.push(...faceUVs[vi]);
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    texcoords: new Float32Array(texcoords),
    indices: new Uint16Array(indices),
  };
}

/** Torus (doughnut) */
export function createTorus(majorR = 0.6, minorR = 0.25, majorSegs = 48, minorSegs = 24): Geometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const texcoords: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= majorSegs; i++) {
    const u = (i / majorSegs) * Math.PI * 2;
    const cosu = Math.cos(u), sinu = Math.sin(u);

    for (let j = 0; j <= minorSegs; j++) {
      const v = (j / minorSegs) * Math.PI * 2;
      const cosv = Math.cos(v), sinv = Math.sin(v);

      const x = (majorR + minorR * cosv) * cosu;
      const y = minorR * sinv;
      const z = (majorR + minorR * cosv) * sinu;
      positions.push(x, y, z);
      normals.push(cosv * cosu, sinv, cosv * sinu);
      texcoords.push(i / majorSegs, j / minorSegs);
    }
  }

  for (let i = 0; i < majorSegs; i++) {
    for (let j = 0; j < minorSegs; j++) {
      const a = i * (minorSegs + 1) + j;
      const b = a + minorSegs + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    texcoords: new Float32Array(texcoords),
    indices: new Uint16Array(indices),
  };
}
