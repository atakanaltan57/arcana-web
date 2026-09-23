"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { toRoman } from "@/lib/cipher";
import { sealPlacement } from "@/lib/gate-layout";
import { clamp01, easeOutCubic } from "@/lib/easing";
import { createGemBezelGeometry, createGemGeometry } from "@/lib/gem-geometry";
import { createGemCrackTexture, createNumeralTexture } from "@/lib/textures/stone-textures";
import { starFragmentShader, starVertexShader } from "@/components/book/starburst";

export const SEAL_BREAK_MS = 1600;
const GEM_WIDTH = 0.14;
const GEM_HEIGHT = 0.31;
const GEM_DEPTH = 0.13;
const SHARD_COUNT = 14;
const CRACK_AT = 0.3;

const DORMANT_COLOR = new THREE.Color("#6a0f1a");
const DORMANT_EMISSIVE = new THREE.Color("#5a0610");
const AWAKE_COLOR = new THREE.Color("#e8a93a");
const AWAKE_EMISSIVE = new THREE.Color("#ff9326");

export function createGemMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: DORMANT_COLOR.clone(),
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    ior: 2.2,
    specularIntensity: 1,
    specularColor: new THREE.Color("#ffe2c8"),
    iridescence: 0.3,
    iridescenceIOR: 1.6,
    emissive: DORMANT_EMISSIVE.clone(),
    emissiveIntensity: 0.45,
    envMapIntensity: 2.4,
    flatShading: true,
  });
}

export function setGemAwakening(material: THREE.MeshPhysicalMaterial, awake: number, pulse: number) {
  material.color.copy(DORMANT_COLOR).lerp(AWAKE_COLOR, awake);
  material.emissive.copy(DORMANT_EMISSIVE).lerp(AWAKE_EMISSIVE, awake);
  material.emissiveIntensity = THREE.MathUtils.lerp(0.35 + pulse * 0.25, 1.25 + pulse * 0.35, awake);
}

type SealAssets = {
  gem: THREE.BufferGeometry;
  crackShell: THREE.BufferGeometry;
  bezel: THREE.ExtrudeGeometry;
  shard: THREE.TetrahedronGeometry;
  gold: THREE.MeshStandardMaterial;
  shardMaterial: THREE.MeshPhysicalMaterial;
  numeralPlane: THREE.PlaneGeometry;
  flare: THREE.PlaneGeometry;
  dispose: () => void;
};

export function useSealAssets(): SealAssets {
  const assets = useMemo(() => {
    const gem = createGemGeometry({ width: GEM_WIDTH, height: GEM_HEIGHT, depth: GEM_DEPTH });
    const crackShell = createGemGeometry({ width: GEM_WIDTH * 1.01, height: GEM_HEIGHT * 1.01, depth: GEM_DEPTH * 1.03 });
    const bezel = createGemBezelGeometry(GEM_WIDTH, GEM_HEIGHT, 0.045, 0.03);
    const shard = new THREE.TetrahedronGeometry(0.035);
    const gold = new THREE.MeshStandardMaterial({ color: "#b08840", metalness: 1, roughness: 0.34, envMapIntensity: 1.6 });
    const shardMaterial = new THREE.MeshPhysicalMaterial({
      color: DORMANT_COLOR,
      roughness: 0.08,
      clearcoat: 1,
      emissive: new THREE.Color("#ff7a2a"),
      emissiveIntensity: 0.9,
      flatShading: true,
    });
    const numeralPlane = new THREE.PlaneGeometry(0.32, 0.16);
    const flare = new THREE.PlaneGeometry(1.6, 1.6);
    return {
      gem,
      crackShell,
      bezel,
      shard,
      gold,
      shardMaterial,
      numeralPlane,
      flare,
      dispose: () => {
        [gem, crackShell, bezel, shard, numeralPlane, flare].forEach((geometry) => geometry.dispose());
        gold.dispose();
        shardMaterial.dispose();
      },
    };
  }, []);
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
  const gemGroup = useRef<THREE.Group>(null);
  const shards = useRef<THREE.InstancedMesh>(null);
  const flareMesh = useRef<THREE.Mesh>(null);
  const scratch = useMemo(() => new THREE.Object3D(), []);

  const { gemMaterial, crackMaterial, numeralMaterial, flareMaterial, shardSeeds } = useMemo(() => {
    const numeral = createNumeralTexture(toRoman(index + 1));
    const crack = createGemCrackTexture(900 + index * 37);
    const seeds = Array.from({ length: SHARD_COUNT }, (_, i) => {
      const angle = (i / SHARD_COUNT) * Math.PI * 2 + Math.sin(index * 13 + i * 7) * 0.4;
      const speed = 0.7 + ((Math.sin(index * 5 + i * 11) + 1) / 2) * 0.8;
      return { angle, speed, lift: 0.4 + ((Math.cos(i * 3 + index) + 1) / 2) * 0.6, spin: 4 + (i % 5) * 2 };
    });
    return {
      gemMaterial: createGemMaterial(),
      crackMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color(3.2, 2.1, 0.9),
        alphaMap: crack,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      numeralMaterial: new THREE.MeshBasicMaterial({ map: numeral, color: "#c9a25a", transparent: true, opacity: 0.7 }),
      flareMaterial: new THREE.ShaderMaterial({
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        uniforms: { uFlash: { value: 0 }, uSpin: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      shardSeeds: seeds,
    };
  }, [index]);

  useEffect(
    () => () => {
      gemMaterial.dispose();
      crackMaterial.alphaMap?.dispose();
      crackMaterial.dispose();
      numeralMaterial.map?.dispose();
      numeralMaterial.dispose();
      flareMaterial.dispose();
    },
    [gemMaterial, crackMaterial, numeralMaterial, flareMaterial],
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const elapsed = breakAt === null ? SEAL_BREAK_MS : performance.now() - breakAt;
    const progress = broken ? clamp01(elapsed / SEAL_BREAK_MS) : 0;
    const cracking = clamp01(progress / CRACK_AT);
    const awake = easeOutCubic(clamp01((progress - CRACK_AT) / (1 - CRACK_AT)));
    const pulse = 0.5 + 0.5 * Math.sin(time * (broken ? 1.7 : 0.9) + index * 1.3);

    setGemAwakening(gemMaterial, awake, pulse);
    crackMaterial.opacity = broken ? cracking * (1 - awake * 0.55) : 0;

    if (gemGroup.current) {
      const tremor = broken && progress < CRACK_AT ? Math.sin(time * 80) * 0.01 * cracking : 0;
      const pop = broken && progress >= CRACK_AT ? 1 + Math.sin(Math.PI * clamp01((progress - CRACK_AT) / 0.25)) * 0.14 : 1;
      gemGroup.current.position.x = tremor;
      gemGroup.current.scale.setScalar(pop);
    }

    const mesh = shards.current;
    if (mesh) {
      const flying = broken && breakAt !== null && progress >= CRACK_AT && progress < 1;
      mesh.visible = flying;
      if (flying) {
        const s = (elapsed - SEAL_BREAK_MS * CRACK_AT) / 1000;
        shardSeeds.forEach((seed, i) => {
          const fade = 1 - clamp01(s / 1.1);
          scratch.position.set(
            Math.cos(seed.angle) * seed.speed * s,
            Math.sin(seed.angle) * seed.speed * s,
            GEM_DEPTH * 0.6 + seed.lift * s,
          );
          scratch.rotation.set(seed.spin * s, seed.spin * 0.7 * s, 0);
          scratch.scale.setScalar(Math.max(0.001, fade));
          scratch.updateMatrix();
          mesh.setMatrixAt(i, scratch.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

    const flash = broken ? Math.max(0, 1 - Math.abs(progress - CRACK_AT) / 0.22) * 1.5 : 0;
    flareMaterial.uniforms.uFlash.value = flash + (broken && progress >= 1 ? 0.16 + 0.1 * Math.sin(time * 1.7 + index) : 0);
    flareMaterial.uniforms.uSpin.value = time * 0.3 + index;
    if (flareMesh.current) flareMesh.current.visible = broken;
  });

  return (
    <group>
      <group position={placement.position} rotation={[0, 0, placement.angle - Math.PI / 2]}>
        <mesh geometry={assets.bezel} material={assets.gold} position={[0, 0, -0.02]} />
        <group ref={gemGroup}>
          <mesh geometry={assets.gem} material={gemMaterial} />
          <mesh geometry={assets.crackShell} material={crackMaterial} renderOrder={7} />
        </group>
        <instancedMesh
          ref={shards}
          args={[assets.shard, assets.shardMaterial, SHARD_COUNT]}
          visible={false}
          frustumCulled={false}
        />
      </group>
      <mesh
        geometry={assets.numeralPlane}
        material={numeralMaterial}
        position={placement.numeral}
        rotation={[0, 0, placement.angle - Math.PI / 2]}
      />
      <Billboard position={[placement.position[0], placement.position[1], placement.position[2] + 0.16]}>
        <mesh ref={flareMesh} geometry={assets.flare} material={flareMaterial} visible={false} renderOrder={8} />
      </Billboard>
    </group>
  );
}
