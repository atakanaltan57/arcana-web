"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BURN_REACH, burnKey } from "@/lib/noise";
import { ritualMotion } from "@/lib/ritual-store";
import { EFFECTS_LAYER } from "@/lib/scene-constants";
import { BURN_DURATION, BURN_IGNITION } from "./ember-particles";
import { burnChunk, noiseChunk } from "./page-materials";

const FLAME_COUNT = 2200;
const HEAT_SLOTS = 12;
const FLAME_LEAD = 0.022;
const FLAME_TRAIL = 0.03;

export const heatSources = {
  points: Array.from({ length: HEAT_SLOTS }, () => new THREE.Vector3()),
  strengths: new Float32Array(HEAT_SLOTS),
  count: 0,
};

const vertexShader = /* glsl */ `
  uniform float uBurn;
  uniform vec2 uBurnOrigin;
  uniform float uTime;
  uniform vec4 uPage;
  uniform float uPageY;
  attribute vec2 aUv;
  attribute float aSeed;
  varying vec2 vQuad;
  varying float vSeed;
  varying float vIntensity;
  ${noiseChunk}
  ${burnChunk}

  void main() {
    float lit = uBurn > 0.0 ? -inkBurnDistance(aUv) : -1.0;
    float intensity = lit > -${FLAME_LEAD.toFixed(3)} ? sin(3.14159 * clamp((lit + ${FLAME_LEAD.toFixed(3)}) / ${(FLAME_LEAD + FLAME_TRAIL).toFixed(3)}, 0.0, 1.0)) : 0.0;
    vIntensity = intensity;
    vSeed = aSeed;
    vQuad = uv;
    if (intensity <= 0.001) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec3 base = vec3(uPage.x + aUv.x * (uPage.y - uPage.x), uPageY, uPage.z - aUv.y * (uPage.z - uPage.w));
    float flicker = 0.78 + 0.14 * sin(uTime * (6.0 + aSeed * 5.0) + aSeed * 40.0) + 0.08 * sin(uTime * 17.0 + aSeed * 13.0);
    float height = (0.2 + aSeed * aSeed * 0.34) * (0.35 + 0.65 * intensity) * flicker;
    float width = height * (0.75 + aSeed * 0.3);
    float lean = sin(uTime * 1.3 + aSeed * 20.0) * 0.18 + 0.08;
    vec4 center = modelViewMatrix * vec4(base, 1.0);
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 right = vec3(1.0, 0.0, 0.0);
    center.xyz += right * ((uv.x - 0.5) * width + lean * width * uv.y * uv.y) + up * uv.y * height;
    gl_Position = projectionMatrix * center;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vQuad;
  varying float vSeed;
  varying float vIntensity;

  float flameHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float flameNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(flameHash(i), flameHash(i + vec2(1.0, 0.0)), u.x), mix(flameHash(i + vec2(0.0, 1.0)), flameHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float flameFbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amp * flameNoise(p);
      p = p * 2.07 + vec2(1.7, 9.2);
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    float v = vQuad.y;
    float t = uTime * (2.2 + vSeed * 1.2);
    vec2 flow = vec2(vQuad.x * 2.4 + vSeed * 17.0, v * 2.6 - t);
    float warp = flameFbm(flow * 0.8);
    float x = (vQuad.x - 0.5) * 2.0 + (warp - 0.5) * 1.1 * v;
    float n = flameFbm(flow + vec2(warp * 1.6, 0.0));

    float profile = 0.5 * pow(1.0 - v, 0.9) * (0.75 + 0.25 * sin(v * 7.0 - t * 1.4 + vSeed * 9.0));
    float body = 1.0 - smoothstep(profile * 0.35, profile, abs(x));
    float tip = 1.0 - smoothstep(0.25, 0.95, v + (n - 0.5) * 0.8);
    float base = smoothstep(0.0, 0.22, v) * (0.6 + 0.4 * smoothstep(0.0, 0.5, v));
    float shape = body * tip * base;

    float temperature = shape * (1.0 - v * 0.65) * (0.55 + 0.75 * n);
    vec3 color = mix(vec3(0.0), vec3(0.55, 0.05, 0.0), smoothstep(0.02, 0.2, temperature));
    color = mix(color, vec3(1.6, 0.45, 0.04), smoothstep(0.18, 0.45, temperature));
    color = mix(color, vec3(2.3, 1.35, 0.3), smoothstep(0.42, 0.7, temperature));
    color = mix(color, vec3(2.6, 2.0, 1.1), smoothstep(0.8, 1.0, temperature));

    float alpha = clamp(temperature * 1.5, 0.0, 1.0) * vIntensity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

type FlameFrontProps = {
  pageMinX: number;
  pageMaxX: number;
  pageNearZ: number;
  pageFarZ: number;
  pageY: number;
};

export function FlameFront({ pageMinX, pageMaxX, pageNearZ, pageFarZ, pageY }: FlameFrontProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const lastBurnId = useRef(-1);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  const { geometry, material, uvs, keys } = useMemo(() => {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1, 1, 6).translate(0.5, 0.5, 0);
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("uv", quad.getAttribute("uv"));
    const flameUvs = new Float32Array(FLAME_COUNT * 2);
    const flameKeys = new Float32Array(FLAME_COUNT).fill(99);
    const seeds = new Float32Array(FLAME_COUNT);
    for (let i = 0; i < FLAME_COUNT; i++) {
      flameUvs[i * 2] = 0.03 + Math.random() * 0.94;
      flameUvs[i * 2 + 1] = 0.03 + Math.random() * 0.94;
      seeds[i] = Math.random();
    }
    geo.setAttribute("aUv", new THREE.InstancedBufferAttribute(flameUvs, 2));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    geo.instanceCount = FLAME_COUNT;
    quad.dispose();

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uBurn: { value: 0 },
        uBurnOrigin: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uPage: { value: new THREE.Vector4() },
        uPageY: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    return { geometry: geo, material: mat, uvs: flameUvs, keys: flameKeys };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      heatSources.count = 0;
    },
    [geometry, material],
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPage.value.set(pageMinX, pageMaxX, pageNearZ, pageFarZ);
    material.uniforms.uPageY.value = pageY + 0.004;

    if (ritualMotion.burnId !== lastBurnId.current) {
      lastBurnId.current = ritualMotion.burnId;
      for (let i = 0; i < FLAME_COUNT; i++) {
        keys[i] = burnKey(uvs[i * 2], uvs[i * 2 + 1], ritualMotion.burnOriginU, ritualMotion.burnOriginV);
      }
    }

    const clock = ritualMotion.burnClock;
    const burn = clock < 0 ? 0 : Math.min(1, Math.max(0, (clock - BURN_IGNITION) / BURN_DURATION));
    const front = clock < 0 ? -1 : burn * BURN_REACH;
    material.uniforms.uBurn.value = clock > 0.02 ? Math.max(0.004, burn) : 0;
    material.uniforms.uBurnOrigin.value.set(ritualMotion.burnOriginU, ritualMotion.burnOriginV);

    let count = 0;
    if (front > 0 && mesh.current) {
      const span = FLAME_LEAD + FLAME_TRAIL;
      for (let i = 0; i < FLAME_COUNT && count < HEAT_SLOTS; i += 29) {
        const lit = front - keys[i];
        if (lit <= -FLAME_LEAD || lit >= FLAME_TRAIL) continue;
        const strength = Math.sin(Math.PI * ((lit + FLAME_LEAD) / span));
        scratch.set(pageMinX + uvs[i * 2] * (pageMaxX - pageMinX), pageY + 0.12, pageNearZ - uvs[i * 2 + 1] * (pageNearZ - pageFarZ));
        mesh.current.localToWorld(scratch);
        heatSources.points[count].copy(scratch);
        heatSources.strengths[count] = strength;
        count += 1;
      }
    }
    heatSources.count = count;
  });

  return (
    <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={6} layers={EFFECTS_LAYER} />
  );
}
