"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { GATE, blockAngles } from "@/lib/gate-layout";
import { usePbrTextures } from "@/lib/textures/pbr";

const BLOCK_REPEAT: [number, number] = [0.32, 0.32];
const PILLAR_REPEAT: [number, number] = [0.35, 1.5];
const WALL_REPEAT: [number, number] = [0.16, 0.16];
const FLOOR_REPEAT: [number, number] = [9, 9];

function archBlockGeometry(index: number) {
  const { start, end } = blockAngles(index);
  const outer = index === Math.floor(GATE.blocks / 2) ? GATE.keystoneOuter : GATE.archOuter;
  const shape = new THREE.Shape();
  const steps = 10;
  shape.moveTo(Math.cos(start) * GATE.openingHalf, Math.sin(start) * GATE.openingHalf);
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps;
    shape.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
  }
  for (let i = steps; i >= 0; i--) {
    const a = start + ((end - start) * i) / steps;
    shape.lineTo(Math.cos(a) * GATE.openingHalf, Math.sin(a) * GATE.openingHalf);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: GATE.depth - 0.06,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geometry.translate(0, GATE.springY, -GATE.depth / 2 + 0.03);
  return geometry;
}

function wallGeometry() {
  const wall = new THREE.Shape();
  wall.moveTo(-16, 0);
  wall.lineTo(16, 0);
  wall.lineTo(16, 18);
  wall.lineTo(-16, 18);
  wall.lineTo(-16, 0);
  const hole = new THREE.Path();
  const w = GATE.archOuter - 0.05;
  hole.moveTo(-w, 0);
  hole.lineTo(-w, GATE.springY);
  hole.absarc(0, GATE.springY, w, Math.PI, 0, true);
  hole.lineTo(w, 0);
  hole.lineTo(-w, 0);
  wall.holes.push(hole);
  return new THREE.ShapeGeometry(wall, 24);
}

export function GateArchitecture() {
  const blockStone = usePbrTextures("rock_05", BLOCK_REPEAT);
  const pillarStone = usePbrTextures("rock_05", PILLAR_REPEAT);
  const wallStone = usePbrTextures("medieval_blocks_03", WALL_REPEAT);
  const floor = usePbrTextures("cobblestone_floor_001", FLOOR_REPEAT);

  const assets = useMemo(() => {
    const blockMaterial = new THREE.MeshStandardMaterial({ ...blockStone, color: "#c9bcaa", normalScale: new THREE.Vector2(1.4, 1.4) });
    const pillarMaterial = new THREE.MeshStandardMaterial({ ...pillarStone, color: "#c9bcaa", normalScale: new THREE.Vector2(1.4, 1.4) });
    const wallMaterial = new THREE.MeshStandardMaterial({ ...wallStone, color: "#9a8f82", normalScale: new THREE.Vector2(1.2, 1.2) });
    const floorMaterial = new THREE.MeshStandardMaterial({ ...floor, color: "#a89e90" });
    const blocks = Array.from({ length: GATE.blocks }, (_, index) => archBlockGeometry(index));
    const pillar = new THREE.BoxGeometry(GATE.archOuter - GATE.openingHalf, GATE.springY, GATE.depth, 1, 4, 1);
    const plinth = new THREE.BoxGeometry(GATE.archOuter - GATE.openingHalf + 0.3, 0.4, GATE.depth + 0.3);
    const capital = new THREE.BoxGeometry(GATE.archOuter - GATE.openingHalf + 0.24, 0.22, GATE.depth + 0.2);
    const wall = wallGeometry();
    const floorPlane = new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2);
    return {
      blockMaterial,
      pillarMaterial,
      wallMaterial,
      floorMaterial,
      blocks,
      pillar,
      plinth,
      capital,
      wall,
      floorPlane,
      dispose: () => {
        [blockMaterial, pillarMaterial, wallMaterial, floorMaterial].forEach((material) => material.dispose());
        [...blocks, pillar, plinth, capital, wall, floorPlane].forEach((geometry) => geometry.dispose());
      },
    };
  }, [blockStone, pillarStone, wallStone, floor]);

  useEffect(() => assets.dispose, [assets]);

  const pillarX = (GATE.openingHalf + GATE.archOuter) / 2;

  return (
    <group>
      <mesh geometry={assets.floorPlane} material={assets.floorMaterial} position={[0, 0, 4]} />
      <mesh geometry={assets.wall} material={assets.wallMaterial} position={[0, 0, -0.35]} />
      {assets.blocks.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={assets.blockMaterial} />
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * pillarX, 0, 0]}>
          <mesh geometry={assets.pillar} material={assets.pillarMaterial} position={[0, GATE.springY / 2, 0]} />
          <mesh geometry={assets.plinth} material={assets.blockMaterial} position={[0, 0.2, 0]} />
          <mesh geometry={assets.capital} material={assets.blockMaterial} position={[0, GATE.springY - 0.05, 0]} />
        </group>
      ))}
    </group>
  );
}
