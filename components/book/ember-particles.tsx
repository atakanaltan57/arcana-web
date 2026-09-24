"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BURN_REACH, burnKey } from "@/lib/noise";
import { ritualMotion } from "@/lib/ritual-store";
import { EFFECTS_LAYER } from "@/lib/scene-constants";

export const BURN_IGNITION = 0.15;
export const BURN_DURATION = 6;

const EMBER_COUNT = 260;
const ASH_COUNT = 90;
const SMOKE_COUNT = 40;

const vertexShader = /* glsl */ `
  uniform float uClock;
  uniform float uPixelRatio;
  uniform vec4 uPage;
  uniform float uPageY;
  attribute vec2 aUv;
  attribute float aSpawn;
  attribute float aSeed;
  attribute float aType;
  varying float vType;
  varying float vLife;
  varying float vSeed;
  varying float vAge;

  void main() {
    vType = aType;
    vSeed = aSeed;
    float life = aType < 0.5 ? 0.9 + aSeed * 1.5 : (aType < 1.5 ? 1.4 + aSeed * 1.0 : 3.0 + aSeed * 1.6);
    float age = uClock - aSpawn;
    vAge = age;
    if (age < 0.0 || age > life) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vLife = 1.0;
      return;
    }
    float k = age / life;
    vLife = k;

    vec3 p = vec3(uPage.x + aUv.x * (uPage.y - uPage.x), uPageY, uPage.z - aUv.y * (uPage.z - uPage.w));
    float phase = aSeed * 43.0;
    if (aType < 0.5) {
      float rise = (0.45 + aSeed * 0.9) * age + 0.4 * age * age;
      float swirl = 0.08 + 0.1 * age;
      p.y += rise;
      p.x += sin(age * 3.1 + phase) * swirl + sin(age * 8.7 + phase * 1.7) * 0.03 + (aSeed - 0.5) * 0.35 * age;
      p.z += cos(age * 2.6 + phase) * swirl + cos(age * 7.9 + phase * 1.3) * 0.03 - 0.12 * age;
    } else if (aType < 1.5) {
      float lift = (0.6 + aSeed * 0.5) * (1.0 - exp(-age * 1.8));
      p.y += lift + 0.18 * age;
      p.x += sin(age * 1.9 + phase) * 0.18 * min(age, 1.5) + (aSeed - 0.5) * 0.35 * age;
      p.z += cos(age * 1.4 + phase) * 0.16 * min(age, 1.5) - 0.05 * age;
    } else {
      p.y += 0.34 * age + 0.07 * age * age;
      p.x += sin(age * 0.8 + phase) * 0.3 * age + 0.05 * age;
      p.z -= 0.12 * age;
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size;
    if (aType < 0.5) size = (3.0 + aSeed * 6.0) * (1.0 - k * 0.55);
    else if (aType < 1.5) size = 2.5 + aSeed * 3.5;
    else size = (34.0 + aSeed * 26.0) * (0.35 + k * 1.1);
    gl_PointSize = size * uPixelRatio * (12.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vType;
  varying float vLife;
  varying float vSeed;
  varying float vAge;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (vType < 0.5) {
      float core = 1.0 - smoothstep(0.0, 0.5, d);
      vec3 hot = vec3(3.0, 1.0, 0.18);
      vec3 cool = vec3(0.8, 0.1, 0.02);
      vec3 color = mix(hot, cool, smoothstep(0.15, 0.9, vLife));
      float twinkle = 0.7 + 0.3 * sin(vAge * 20.0 + vSeed * 50.0);
      float alpha = pow(core, 1.6) * twinkle * (1.0 - smoothstep(0.65, 1.0, vLife));
      gl_FragColor = vec4(color, alpha);
    } else if (vType < 1.5) {
      float tumble = 0.35 + 0.65 * abs(sin(vAge * (2.0 + vSeed * 3.0) + vSeed * 20.0));
      vec2 q = vec2(c.x / tumble, c.y * (1.3 + vSeed * 0.6));
      float angle = atan(q.y, q.x);
      float radius = 0.44 + 0.03 * sin(angle * 3.0 + vSeed * 30.0);
      float flake = 1.0 - smoothstep(radius - 0.08, radius, length(q));
      float edge = smoothstep(radius - 0.16, radius - 0.04, length(q));
      float glowing = 1.0 - smoothstep(0.05, 0.22, vLife);
      vec3 body = mix(vec3(0.12, 0.1, 0.09), vec3(0.36, 0.34, 0.32), smoothstep(0.15, 0.6, vLife));
      vec3 color = body + vec3(1.6, 0.35, 0.05) * edge * glowing;
      float alpha = flake * 0.6 * (1.0 - smoothstep(0.5, 1.0, vLife));
      gl_FragColor = vec4(color, alpha);
    } else {
      float angle = atan(c.y, c.x);
      float wobble = 0.5 + 0.07 * sin(angle * 3.0 + vSeed * 12.0 + vAge * 0.8) + 0.04 * sin(angle * 7.0 - vAge);
      float puff = 1.0 - smoothstep(0.0, wobble, d);
      float alpha = puff * puff * 0.2 * smoothstep(0.0, 0.12, vLife) * (1.0 - smoothstep(0.45, 1.0, vLife));
      gl_FragColor = vec4(vec3(0.3, 0.27, 0.24), alpha);
    }
  }
`;

type EmberParticlesProps = {
  pageMinX: number;
  pageMaxX: number;
  pageNearZ: number;
  pageFarZ: number;
  pageY: number;
};

export function EmberParticles({ pageMinX, pageMaxX, pageNearZ, pageFarZ, pageY }: EmberParticlesProps) {
  const dpr = useThree((state) => state.viewport.dpr);
  const lastBurnId = useRef(-1);

  const { geometry, material } = useMemo(() => {
    const total = EMBER_COUNT + ASH_COUNT + SMOKE_COUNT;
    const geo = new THREE.BufferGeometry();
    const seeds = new Float32Array(total);
    const types = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      seeds[i] = Math.random();
      types[i] = i < EMBER_COUNT ? 0 : i < EMBER_COUNT + ASH_COUNT ? 1 : 2;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    geo.setAttribute("aUv", new THREE.BufferAttribute(new Float32Array(total * 2), 2));
    geo.setAttribute("aSpawn", new THREE.BufferAttribute(new Float32Array(total).fill(1e6), 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute("aType", new THREE.BufferAttribute(types, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uClock: { value: -1 },
        uPixelRatio: { value: 1 },
        uPage: { value: new THREE.Vector4() },
        uPageY: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    return { geometry: geo, material: mat };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    material.uniforms.uPixelRatio.value = dpr;
    material.uniforms.uPage.value.set(pageMinX, pageMaxX, pageNearZ, pageFarZ);
    material.uniforms.uPageY.value = pageY + 0.01;
    material.uniforms.uClock.value = ritualMotion.burnClock;

    if (ritualMotion.burnId === lastBurnId.current) return;
    lastBurnId.current = ritualMotion.burnId;
    const uvAttr = geometry.getAttribute("aUv") as THREE.BufferAttribute;
    const spawnAttr = geometry.getAttribute("aSpawn") as THREE.BufferAttribute;
    const typeAttr = geometry.getAttribute("aType") as THREE.BufferAttribute;
    const seedAttr = geometry.getAttribute("aSeed") as THREE.BufferAttribute;
    const { burnOriginU, burnOriginV } = ritualMotion;
    for (let i = 0; i < uvAttr.count; i++) {
      const u = 0.02 + Math.random() * 0.96;
      const v = 0.02 + Math.random() * 0.96;
      const key = burnKey(u, v, burnOriginU, burnOriginV);
      const type = typeAttr.getX(i);
      const lag = type < 0.5 ? 0 : type < 1.5 ? 0.06 : 0.02;
      const passTime = BURN_IGNITION + ((key + lag) / BURN_REACH) * BURN_DURATION;
      uvAttr.setXY(i, u, v);
      spawnAttr.setX(i, passTime + seedAttr.getX(i) * 0.12);
    }
    uvAttr.needsUpdate = true;
    spawnAttr.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} layers={EFFECTS_LAYER} />;
}
