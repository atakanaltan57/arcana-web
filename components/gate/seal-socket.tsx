"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { toRoman } from "@/lib/cipher";
import { sealPlacement } from "@/lib/gate-layout";
import { clamp01, easeOutCubic } from "@/lib/easing";
import { createGemBezelGeometry, createGemFoilGeometry, createGemGeometry } from "@/lib/gem-geometry";
import { createGemCrackTexture, createNumeralTexture } from "@/lib/textures/stone-textures";
import { starFragmentShader, starVertexShader } from "@/components/book/starburst";

export const SEAL_BREAK_MS = 1600;
const GEM_WIDTH = 0.15;
const GEM_HEIGHT = 0.32;
const GEM_DEPTH = 0.16;
const SHARD_COUNT = 14;
const CRACK_AT = 0.3;

const DORMANT_TINT = new THREE.Color("#d9c7ad");
const AWAKE_TINT = new THREE.Color("#fff1d2");
const DORMANT_ATTENUATION = new THREE.Color("#5a4230");
const AWAKE_ATTENUATION = new THREE.Color("#ffd98f");
const INNER_LIGHT = new THREE.Color(1, 0.86, 0.62);
const FOIL_DORMANT = new THREE.Color("#6e5530");
const FOIL_AWAKE = new THREE.Color("#f3d08a");

type GemUniforms = { uTime: { value: number } };

export function createGemMaterial() {
  const uniforms: GemUniforms = { uTime: { value: 0 } };
  const material = new THREE.MeshPhysicalMaterial({
    color: DORMANT_TINT.clone(),
    roughness: 0.02,
    metalness: 0,
    transmission: 1,
    thickness: 0.22,
    ior: 2.42,
    dispersion: 5,
    attenuationColor: DORMANT_ATTENUATION.clone(),
    attenuationDistance: 0.08,
    specularIntensity: 1,
    specularColor: new THREE.Color("#fff4e2"),
    clearcoat: 1,
    clearcoatRoughness: 0,
    emissive: INNER_LIGHT.clone(),
    emissiveIntensity: 0.03,
    envMapIntensity: 3.2,
    flatShading: true,
  });
  material.userData.gemUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `uniform float uTime;\n${shader.fragmentShader}`.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float facetPhase = dot(normal, vec3(13.1, 7.7, 5.3)) * 6.0;
      totalEmissiveRadiance *= 0.2 + 1.3 * pow(0.5 + 0.5 * sin(facetPhase + uTime * 2.2), 3.0);`,
    );
  };
  return material;
}

export function setGemAwakening(material: THREE.MeshPhysicalMaterial, awake: number, time: number) {
  const uniforms = material.userData.gemUniforms as GemUniforms | undefined;
  if (uniforms) uniforms.uTime.value = time;
  material.color.copy(DORMANT_TINT).lerp(AWAKE_TINT, awake);
  material.attenuationColor.copy(DORMANT_ATTENUATION).lerp(AWAKE_ATTENUATION, awake);
  material.attenuationDistance = THREE.MathUtils.lerp(0.14, 0.7, awake * awake);
  material.emissiveIntensity = THREE.MathUtils.lerp(0.03, 0.5, awake);
}

export function createFoilMaterial() {
  return new THREE.MeshStandardMaterial({
    color: FOIL_DORMANT.clone(),
    metalness: 1,
    roughness: 0.28,
    emissive: new THREE.Color("#ffe2a8"),
    emissiveIntensity: 0,
    envMapIntensity: 2,
  });
}

export function setFoilAwakening(material: THREE.MeshStandardMaterial, awake: number, pulse: number) {
  material.color.copy(FOIL_DORMANT).lerp(FOIL_AWAKE, awake);
  material.emissiveIntensity = awake * (0.55 + pulse * 0.3);
}

function twinkle(time: number, seed: number) {
  return (
    Math.pow(Math.max(0, Math.sin(time * 0.83 + seed * 2.1)), 40) +
    Math.pow(Math.max(0, Math.sin(time * 1.37 + seed * 4.7)), 70) * 0.6
  );
}

type SealAssets = {
  gem: THREE.BufferGeometry;
  crackShell: THREE.BufferGeometry;
  foil: THREE.ShapeGeometry;
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
    const foil = createGemFoilGeometry(GEM_WIDTH * 0.98, GEM_HEIGHT * 0.98);
    const bezel = createGemBezelGeometry(GEM_WIDTH * 1.05, GEM_HEIGHT * 1.03, 0.05, 0.035);
    const shard = new THREE.TetrahedronGeometry(0.032);
    const gold = new THREE.MeshStandardMaterial({ color: "#b8904a", metalness: 1, roughness: 0.3, envMapIntensity: 1.8 });
    const shardMaterial = new THREE.MeshPhysicalMaterial({
      color: "#fff3dd",
      roughness: 0.05,
      clearcoat: 1,
      emissive: INNER_LIGHT.clone(),
      emissiveIntensity: 1.3,
      flatShading: true,
    });
    const numeralPlane = new THREE.PlaneGeometry(0.32, 0.16);
    const flare = new THREE.PlaneGeometry(1.6, 1.6);
    return {
      gem,
      crackShell,
      foil,
      bezel,
      shard,
      gold,
      shardMaterial,
      numeralPlane,
      flare,
      dispose: () => {
        [gem, crackShell, foil, bezel, shard, numeralPlane, flare].forEach((geometry) => geometry.dispose());
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

  const { gemMaterial, foilMaterial, crackMaterial, numeralMaterial, flareMaterial, shardSeeds } = useMemo(() => {
    const numeral = createNumeralTexture(toRoman(index + 1));
    const crack = createGemCrackTexture(900 + index * 37);
    const seeds = Array.from({ length: SHARD_COUNT }, (_, i) => {
      const angle = (i / SHARD_COUNT) * Math.PI * 2 + Math.sin(index * 13 + i * 7) * 0.4;
      const speed = 0.7 + ((Math.sin(index * 5 + i * 11) + 1) / 2) * 0.8;
      return { angle, speed, lift: 0.4 + ((Math.cos(i * 3 + index) + 1) / 2) * 0.6, spin: 4 + (i % 5) * 2 };
    });
    return {
      gemMaterial: createGemMaterial(),
      foilMaterial: createFoilMaterial(),
      crackMaterial: new THREE.MeshBasicMaterial({
        color: new THREE.Color(3.2, 2.6, 1.8),
        alphaMap: crack,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      numeralMaterial: new THREE.MeshBasicMaterial({ map: numeral, color: "#d9b56a", transparent: true, opacity: 0.85 }),
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
      foilMaterial.dispose();
      crackMaterial.alphaMap?.dispose();
      crackMaterial.dispose();
      numeralMaterial.map?.dispose();
      numeralMaterial.dispose();
      flareMaterial.dispose();
    },
    [gemMaterial, foilMaterial, crackMaterial, numeralMaterial, flareMaterial],
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const elapsed = breakAt === null ? SEAL_BREAK_MS : performance.now() - breakAt;
    const progress = broken ? clamp01(elapsed / SEAL_BREAK_MS) : 0;
    const cracking = clamp01(progress / CRACK_AT);
    const awake = easeOutCubic(clamp01((progress - CRACK_AT) / (1 - CRACK_AT)));
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.7 + index * 1.3);
    const sparkle = twinkle(time, index);

    setGemAwakening(gemMaterial, awake, time);
    setFoilAwakening(foilMaterial, awake, pulse);
    crackMaterial.opacity = broken ? cracking * (1 - awake) : 0;

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

    const burst = broken ? Math.max(0, 1 - Math.abs(progress - CRACK_AT) / 0.22) * 1.5 : 0;
    const glow = THREE.MathUtils.lerp(sparkle * 0.18, 0.22 + sparkle * 0.7, awake);
    flareMaterial.uniforms.uFlash.value = burst + glow;
    flareMaterial.uniforms.uSpin.value = 0.2 + Math.sin(time * 0.3 + index) * 0.15;
    if (flareMesh.current) {
      flareMesh.current.visible = burst + glow > 0.003;
      flareMesh.current.scale.setScalar(burst > 0.05 ? 1 : 0.55);
    }
  });

  return (
    <group>
      <group position={placement.position} rotation={[0, 0, placement.angle - Math.PI / 2]}>
        <mesh geometry={assets.bezel} material={assets.gold} position={[0, 0, -0.025]} />
        <mesh geometry={assets.foil} material={foilMaterial} position={[0, 0, 0.012]} />
        <group ref={gemGroup} position={[0, 0, 0.014]}>
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
      <Billboard position={[placement.position[0], placement.position[1], placement.position[2] + 0.2]}>
        <mesh ref={flareMesh} geometry={assets.flare} material={flareMaterial} visible={false} renderOrder={8} />
      </Billboard>
    </group>
  );
}
