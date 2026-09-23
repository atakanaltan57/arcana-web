"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DOOR_HEIGHT, GATE } from "@/lib/gate-layout";
import { easeInOutCubic } from "@/lib/easing";
import { usePbrTextures } from "@/lib/textures/pbr";
import { createSymbolMask } from "@/lib/textures/stone-textures";

export const DOOR_OPEN_MS = 3800;
const DOOR_THICKNESS = 0.16;
const DOOR_MAX_ANGLE = 1.4;
const HALF = GATE.openingHalf - 0.02;
const WOOD_REPEAT: [number, number] = [1.1, 1.1 * (DOOR_HEIGHT / (GATE.openingHalf * 2))];
const IRON_REPEAT: [number, number] = [2.5, 0.25];
const SEAL_SIZE = 2.35;
const SEAL_CENTER_Y = 3.05;
const BAND_HEIGHTS = [0.75, 4.42];

function doorGeometry(side: -1 | 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(side * HALF, 0);
  shape.lineTo(side * HALF, GATE.springY);
  shape.absarc(0, GATE.springY, HALF, side === 1 ? 0 : Math.PI, Math.PI / 2, side === -1);
  shape.lineTo(0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: DOOR_THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 1,
    curveSegments: 24,
  });
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    uvs.setXY(i, (positions.getX(i) + GATE.openingHalf) / (GATE.openingHalf * 2), positions.getY(i) / DOOR_HEIGHT);
  }
  geometry.translate(-side * HALF, 0, -DOOR_THICKNESS / 2);
  return geometry;
}

function sealHalfGeometry(side: -1 | 1) {
  const geometry = new THREE.PlaneGeometry(SEAL_SIZE / 2, SEAL_SIZE);
  const uvs = geometry.attributes.uv;
  for (let i = 0; i < uvs.count; i++) {
    uvs.setX(i, side === -1 ? uvs.getX(i) * 0.5 : 0.5 + uvs.getX(i) * 0.5);
  }
  return geometry;
}

type DoorLeafProps = {
  side: -1 | 1;
  geometry: THREE.BufferGeometry;
  sealGeometry: THREE.BufferGeometry;
  wood: THREE.Material;
  iron: THREE.Material;
  gold: THREE.Material;
  band: THREE.BufferGeometry;
  ring: THREE.BufferGeometry;
  mount: THREE.BufferGeometry;
};

function DoorLeaf({ side, geometry, sealGeometry, wood, iron, gold, band, ring, mount }: DoorLeafProps) {
  const inward = -side;
  const front = DOOR_THICKNESS / 2 + 0.012;
  return (
    <>
      <mesh geometry={geometry} material={wood} />
      {BAND_HEIGHTS.map((y) => (
        <mesh key={y} geometry={band} material={iron} position={[inward * HALF * 0.5, y, front + 0.012]} />
      ))}
      <mesh geometry={sealGeometry} material={gold} position={[inward * (HALF - SEAL_SIZE / 4), SEAL_CENTER_Y, front + 0.004]} />
      <mesh geometry={mount} material={iron} position={[inward * (HALF - 0.45), 1.5, front + 0.02]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={ring} material={iron} position={[inward * (HALF - 0.45), 1.28, front + 0.05]} />
    </>
  );
}

type GateDoorsProps = {
  openAt: number | null;
};

export function GateDoors({ openAt }: GateDoorsProps) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const woodTextures = usePbrTextures("medieval_wood", WOOD_REPEAT);
  const ironTextures = usePbrTextures("rusty_metal_03", IRON_REPEAT);

  const assets = useMemo(() => {
    const mask = createSymbolMask(1024, true);
    const wood = new THREE.MeshStandardMaterial({
      ...woodTextures,
      color: "#8a7560",
      normalScale: new THREE.Vector2(1.3, 1.3),
    });
    const iron = new THREE.MeshStandardMaterial({
      ...ironTextures,
      color: "#9a8270",
      metalness: 0.35,
      normalScale: new THREE.Vector2(1.2, 1.2),
    });
    const gold = new THREE.MeshStandardMaterial({
      color: "#d4a94f",
      metalness: 1,
      roughness: 0.32,
      alphaMap: mask,
      transparent: true,
      bumpMap: mask,
      bumpScale: 2,
      emissive: new THREE.Color("#f0c56a"),
      emissiveMap: mask,
      emissiveIntensity: 0.12,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const leftGeometry = doorGeometry(-1);
    const rightGeometry = doorGeometry(1);
    const leftSeal = sealHalfGeometry(-1);
    const rightSeal = sealHalfGeometry(1);
    const band = new THREE.BoxGeometry(HALF, 0.24, 0.035);
    const ring = new THREE.TorusGeometry(0.2, 0.028, 12, 32);
    const mount = new THREE.CylinderGeometry(0.07, 0.09, 0.06, 16);
    const beyond = new THREE.PlaneGeometry(GATE.openingHalf * 2, DOOR_HEIGHT);
    const beyondMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpen;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv - vec2(0.5, 0.42);
          float r = length(p * vec2(1.0, 0.7));
          float a = atan(p.y, p.x);
          float rays = 0.5 + 0.5 * sin(a * 14.0 + uTime * 0.4) * sin(a * 9.0 - uTime * 0.3);
          float core = exp(-r * 3.2);
          vec3 color = mix(vec3(0.9, 0.5, 0.16), vec3(1.6, 1.15, 0.6), core);
          color += vec3(1.2, 0.85, 0.4) * rays * core * 0.7;
          color += vec3(2.2, 1.9, 1.4) * exp(-r * 9.0);
          gl_FragColor = vec4(color * uOpen, 1.0);
        }
      `,
      toneMapped: false,
    });
    return {
      wood,
      iron,
      gold,
      leftGeometry,
      rightGeometry,
      leftSeal,
      rightSeal,
      band,
      ring,
      mount,
      beyond,
      beyondMaterial,
      dispose: () => {
        mask.dispose();
        [wood, iron, gold, beyondMaterial].forEach((material) => material.dispose());
        [leftGeometry, rightGeometry, leftSeal, rightSeal, band, ring, mount, beyond].forEach((geometry) =>
          geometry.dispose(),
        );
      },
    };
  }, [woodTextures, ironTextures]);

  useEffect(() => assets.dispose, [assets]);

  useFrame(({ clock }) => {
    const progress = openAt === null ? 0 : Math.min(1, (performance.now() - openAt) / DOOR_OPEN_MS);
    const swing = easeInOutCubic((progress - 0.12) / 0.88) * DOOR_MAX_ANGLE;
    const shake = progress > 0 && progress < 0.15 ? Math.sin(clock.elapsedTime * 60) * 0.004 : 0;
    if (left.current) {
      left.current.rotation.y = swing;
      left.current.position.x = -HALF + shake;
    }
    if (right.current) {
      right.current.rotation.y = -swing;
      right.current.position.x = HALF - shake;
    }
    assets.gold.emissiveIntensity = 0.12 + Math.sin(clock.elapsedTime * 1.2) * 0.05 + progress * 1.8;
    if (glow.current) glow.current.visible = progress > 0.05;
    assets.beyondMaterial.uniforms.uTime.value = clock.elapsedTime;
    assets.beyondMaterial.uniforms.uOpen.value = Math.min(1, progress * 1.6);
    if (light.current) light.current.intensity = progress * 60;
  });

  const shared = { wood: assets.wood, iron: assets.iron, gold: assets.gold, band: assets.band, ring: assets.ring, mount: assets.mount };

  return (
    <group>
      <group ref={left} position={[-HALF, 0, 0]}>
        <DoorLeaf side={-1} geometry={assets.leftGeometry} sealGeometry={assets.leftSeal} {...shared} />
      </group>
      <group ref={right} position={[HALF, 0, 0]}>
        <DoorLeaf side={1} geometry={assets.rightGeometry} sealGeometry={assets.rightSeal} {...shared} />
      </group>
      <mesh ref={glow} geometry={assets.beyond} material={assets.beyondMaterial} position={[0, DOOR_HEIGHT / 2, -1.6]} visible={false} />
      <pointLight ref={light} position={[0, 3, -0.8]} color="#ffd79a" intensity={0} decay={2} />
    </group>
  );
}
