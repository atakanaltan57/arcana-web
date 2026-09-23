import * as THREE from "three";

type GemOptions = {
  width: number;
  height: number;
  depth: number;
  half?: -1 | 1;
};

const OUTLINE: [number, number][] = [
  [0, 1],
  [-0.54, 0.54],
  [-1, 0],
  [-0.54, -0.54],
  [0, -1],
  [0.54, -0.54],
  [1, 0],
  [0.54, 0.54],
];

const RINGS = [
  { scale: 1, z: 0, lift: 0 },
  { scale: 1, z: 0.14, lift: 0 },
  { scale: 0.64, z: 0.62, lift: 0.08 },
  { scale: 0.3, z: 0.96, lift: 0.02 },
];

export function createGemGeometry({ width, height, depth, half }: GemOptions) {
  const clampX = (x: number) => (half === undefined ? x : half < 0 ? Math.min(x, 0) : Math.max(x, 0));
  const point = (ringIndex: number, pointIndex: number) => {
    const ring = RINGS[ringIndex];
    const [ox, oy] = OUTLINE[pointIndex % OUTLINE.length];
    const isMid = pointIndex % 2 === 1;
    const z = (ring.z + (isMid ? ring.lift : 0)) * depth;
    return new THREE.Vector3(clampX(ox * ring.scale * width), oy * ring.scale * height, z);
  };

  const positions: number[] = [];
  const push = (...vertices: THREE.Vector3[]) => vertices.forEach((v) => positions.push(v.x, v.y, v.z));

  for (let ring = 0; ring < RINGS.length - 1; ring++) {
    for (let i = 0; i < OUTLINE.length; i++) {
      const a0 = point(ring, i);
      const a1 = point(ring, i + 1);
      const b0 = point(ring + 1, i);
      const b1 = point(ring + 1, i + 1);
      push(a0, a1, b1, a0, b1, b0);
    }
  }
  const apex = new THREE.Vector3(0, 0, depth);
  const top = RINGS.length - 1;
  for (let i = 0; i < OUTLINE.length; i++) {
    push(apex, point(top, i), point(top, i + 1));
  }

  if (half !== undefined) {
    const profile = [
      ...RINGS.map((_, ring) => point(ring, 0)),
      apex,
      ...RINGS.map((_, ring) => point(ring, 4)).reverse(),
    ];
    const center = new THREE.Vector3(0, 0, depth * 0.4);
    for (let i = 0; i < profile.length - 1; i++) {
      push(center, profile[i], profile[i + 1]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const uvs: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    uvs.push(positions[i] / (2 * width) + 0.5, positions[i + 1] / (2 * height) + 0.5);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

export function createGemBezelGeometry(width: number, height: number, rim: number, thickness: number) {
  const outer = new THREE.Shape();
  outer.moveTo(0, height + rim * 1.6);
  outer.lineTo(-(width + rim), 0);
  outer.lineTo(0, -(height + rim * 1.6));
  outer.lineTo(width + rim, 0);
  outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0, height * 0.97);
  hole.lineTo(width * 0.97, 0);
  hole.lineTo(0, -height * 0.97);
  hole.lineTo(-width * 0.97, 0);
  hole.closePath();
  outer.holes.push(hole);
  return new THREE.ExtrudeGeometry(outer, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.4,
    bevelSize: rim * 0.25,
    bevelSegments: 2,
  });
}
