"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { toRoman } from "@/lib/cipher";
import { sealPlacement } from "@/lib/gate-layout";
import { clamp01, easeOutCubic } from "@/lib/easing";
import { createNumeralTexture, createWaxSealNormal } from "@/lib/textures/stone-textures";
import { starFragmentShader, starVertexShader } from "@/components/book/starburst";

export const SEAL_BREAK_MS = 1600;
const RADIUS = 0.34;

function waxShape(from: number, to: number, jagged: boolean) {
  const shape = new THREE.Shape();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    const r = RADIUS * (1 + 0.07 * Math.sin(a * 5 + 0.7) + 0.04 * Math.sin(a * 11 + 2.1));
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  if (jagged) {
    const cuts = 6;
    for (let i = 1; i < cuts; i++) {
      const y = Math.sin(to) * RADIUS * (1 - (2 * i) / cuts);
      shape.lineTo((i % 2 === 0 ? 0.03 : -0.03) * (to > Math.PI ? 1 : -1), y);
    }
  }
  shape.closePath();
  return shape;
}

function waxGeometry(shape: THREE.Shape) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 12,
  });
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    uvs.setXY(i, (positions.getX(i) + RADIUS * 1.2) / (RADIUS * 2.4), (positions.getY(i) + RADIUS * 1.2) / (RADIUS * 2.4));
  }
  return geometry;
}

type SealAssets = {
  whole: THREE.ExtrudeGeometry;
  leftHalf: THREE.ExtrudeGeometry;
  rightHalf: THREE.ExtrudeGeometry;
  wax: THREE.MeshPhysicalMaterial;
  glow: THREE.MeshBasicMaterial;
  hollow: THREE.MeshStandardMaterial;
  socket: THREE.PlaneGeometry;
  hollowDisc: THREE.CircleGeometry;
  numeralPlane: THREE.PlaneGeometry;
  flare: THREE.PlaneGeometry;
  dispose: () => void;
};

export function useSealAssets(emboss: THREE.Texture): SealAssets {
  const assets = useMemo(() => {
    const whole = waxGeometry(waxShape(0, Math.PI * 2, false));
    const leftHalf = waxGeometry(waxShape(Math.PI / 2, (Math.PI * 3) / 2, true));
    const rightHalf = waxGeometry(waxShape(-Math.PI / 2, Math.PI / 2, true));
    const waxNormal = createWaxSealNormal(1 / 2.4);
    const wax = new THREE.MeshPhysicalMaterial({
      color: "#8e1a15",
      roughness: 0.32,
      clearcoat: 0.85,
      clearcoatRoughness: 0.22,
      normalMap: waxNormal,
      normalScale: new THREE.Vector2(1.4, 1.4),
      sheen: 0.45,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color("#e0664a"),
      emissive: new THREE.Color("#3a0604"),
      emissiveIntensity: 0.35,
    });
    const glow = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 1.55, 0.55),
      alphaMap: emboss,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const hollow = new THREE.MeshStandardMaterial({ color: "#1a120a", roughness: 0.9, emissive: new THREE.Color("#5a3510"), emissiveIntensity: 0.6 });
    const socket = new THREE.PlaneGeometry(RADIUS * 1.9, RADIUS * 1.9);
    const hollowDisc = new THREE.CircleGeometry(RADIUS * 0.95, 40);
    const numeralPlane = new THREE.PlaneGeometry(0.32, 0.16);
    const flare = new THREE.PlaneGeometry(1.6, 1.6);
    return {
      whole,
      leftHalf,
      rightHalf,
      wax,
      glow,
      hollow,
      socket,
      hollowDisc,
      numeralPlane,
      flare,
      dispose: () => {
        [whole, leftHalf, rightHalf, socket, hollowDisc, numeralPlane, flare].forEach((geometry) => geometry.dispose());
        wax.dispose();
        waxNormal.dispose();
        glow.dispose();
        hollow.dispose();
      },
    };
  }, [emboss]);
  useEffect(() => assets.dispose, [assets]);
  return assets;
}

type SealSocketProps = {
  index: number;
  broken: boolean;
  breakAt: number | null;
  assets: SealAssets;
};

export function SealSocket({ index, broken, breakAt, assets }: SealSocketProps) {
  const placement = sealPlacement(index);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const whole = useRef<THREE.Mesh>(null);
  const socket = useRef<THREE.Group>(null);
  const flareMesh = useRef<THREE.Mesh>(null);

  const { numeralMaterial, flareMaterial } = useMemo(() => {
    const texture = createNumeralTexture(toRoman(index + 1));
    return {
      numeralMaterial: new THREE.MeshBasicMaterial({ map: texture, color: "#c9a25a", transparent: true, opacity: 0.7 }),
      flareMaterial: new THREE.ShaderMaterial({
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        uniforms: { uFlash: { value: 0 }, uSpin: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    };
  }, [index]);

  useEffect(
    () => () => {
      numeralMaterial.map?.dispose();
      numeralMaterial.dispose();
      flareMaterial.dispose();
    },
    [numeralMaterial, flareMaterial],
  );

  useFrame(({ clock }) => {
    const elapsed = breakAt === null ? SEAL_BREAK_MS : performance.now() - breakAt;
    const progress = broken ? clamp01(elapsed / SEAL_BREAK_MS) : 0;
    const split = easeOutCubic(clamp01((progress - 0.25) / 0.75));
    const tremor = broken && progress < 0.25 ? Math.sin(clock.elapsedTime * 70) * 0.012 : 0;

    if (whole.current) {
      whole.current.visible = !broken || progress < 0.25;
      whole.current.position.x = tremor;
    }
    for (const [mesh, side] of [
      [left.current, -1],
      [right.current, 1],
    ] as const) {
      if (!mesh) continue;
      mesh.visible = broken && progress >= 0.25;
      mesh.position.set(side * split * 0.2, -split * 0.16, split * 0.06);
      mesh.rotation.z = side * -split * 0.5;
    }
    if (socket.current) {
      socket.current.visible = broken;
      const pulse = 0.9 + 0.1 * Math.sin(clock.elapsedTime * 2 + index);
      socket.current.scale.setScalar(Math.max(0.01, split) * pulse);
    }
    const flash = broken ? Math.max(0, 1 - Math.abs(progress - 0.3) / 0.25) * 1.4 : 0;
    flareMaterial.uniforms.uFlash.value = flash + (broken && progress >= 1 ? 0.12 + 0.08 * Math.sin(clock.elapsedTime * 1.7 + index) : 0);
    flareMaterial.uniforms.uSpin.value = clock.elapsedTime * 0.3 + index;
    if (flareMesh.current) flareMesh.current.visible = broken;
  });

  return (
    <group>
      <group position={placement.position} rotation={[0, 0, placement.angle - Math.PI / 2]}>
        <group ref={socket} visible={false}>
          <mesh geometry={assets.hollowDisc} material={assets.hollow} position={[0, 0, 0.004]} />
          <mesh geometry={assets.socket} material={assets.glow} position={[0, 0, 0.01]} />
        </group>
        <mesh ref={whole} geometry={assets.whole} material={assets.wax} />
        <mesh ref={left} geometry={assets.leftHalf} material={assets.wax} visible={false} />
        <mesh ref={right} geometry={assets.rightHalf} material={assets.wax} visible={false} />
      </group>
      <mesh
        geometry={assets.numeralPlane}
        material={numeralMaterial}
        position={placement.numeral}
        rotation={[0, 0, placement.angle - Math.PI / 2]}
      />
      <Billboard position={[placement.position[0], placement.position[1], placement.position[2] + 0.12]}>
        <mesh ref={flareMesh} geometry={assets.flare} material={flareMaterial} visible={false} renderOrder={8} />
      </Billboard>
    </group>
  );
}
