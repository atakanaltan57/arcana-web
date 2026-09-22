"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ritualMotion } from "@/lib/ritual-store";
import {
  BEAM_ORIGIN,
  BEAM_RADIUS_GROWTH,
  BEAM_RADIUS_START,
  BEAM_TARGET,
  EFFECTS_LAYER,
  FLAME_POSITION,
} from "@/lib/scene-constants";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uAttract;
  uniform float uBurst;
  uniform float uFocus;
  uniform vec3 uBeamOrigin;
  uniform vec3 uBeamDir;
  uniform float uBeamRadius;
  uniform float uBeamGrowth;
  uniform vec3 uFlame;
  attribute float aSeed;
  varying float vAlpha;
  varying float vBokeh;
  varying float vHeat;

  void main() {
    vec3 p = position;
    float t = uTime * 0.06 + aSeed * 20.0;
    p.x += sin(t * 1.3 + aSeed * 6.0) * 0.45 + sin(uTime * 0.9 + aSeed * 70.0) * 0.03;
    p.z += cos(t * 1.1 + aSeed * 4.0) * 0.45 + cos(uTime * 1.1 + aSeed * 50.0) * 0.03;
    p.y = mod(p.y + uTime * 0.025 * (0.3 + aSeed), 7.4) + 0.1;

    vec3 center = vec3(0.0, 0.7, 0.0);
    float pull = uAttract * (0.45 + 0.55 * aSeed);
    float swirl = uAttract * 2.4 + aSeed * 6.28;
    vec3 orbit = center + vec3(cos(swirl + uTime * 2.0), 0.15 * sin(uTime * 3.0 + aSeed * 9.0), sin(swirl + uTime * 2.0)) * (0.35 + aSeed * 1.8);
    p = mix(p, orbit, pull * 0.92);
    p += normalize(p - center + 0.001) * uBurst * (1.5 + aSeed * 2.5);

    vec3 rel = p - uBeamOrigin;
    float along = max(dot(rel, uBeamDir), 0.0);
    float radial = length(rel - uBeamDir * along);
    float radius = uBeamRadius + uBeamGrowth * along;
    float inBeam = 1.0 - smoothstep(radius * 0.45, radius, radial);
    float flameDist = length(p - uFlame);
    float nearFlame = 1.0 / (1.0 + flameDist * flameDist * 0.35);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    float coc = clamp(abs(depth - uFocus) / uFocus, 0.0, 1.0);
    vBokeh = smoothstep(0.08, 0.4, coc);

    float flash = pow(max(0.0, sin(uTime * (0.35 + aSeed * 0.9) + aSeed * 57.0)), 60.0) * 3.0;
    float sharpLight = 0.1 + inBeam * (1.0 + flash) + nearFlame * 0.9 + uAttract * 1.4 + uBurst;
    float bokehLight = (inBeam + nearFlame * 0.6) * 0.6;
    float light = mix(sharpLight, bokehLight, smoothstep(0.02, 0.14, coc));
    vHeat = clamp(nearFlame * 1.5 + uAttract, 0.0, 1.0);

    float baseSize = (0.55 + aSeed * 1.2) * (1.0 + uAttract * 0.8);
    gl_PointSize = baseSize * (1.0 + vBokeh * 5.0) * uPixelRatio * (22.0 / depth);
    float fadeY = smoothstep(0.1, 0.6, p.y) * (1.0 - smoothstep(6.6, 7.4, p.y));
    vAlpha = light * fadeY / (1.0 + vBokeh * 9.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vBokeh;
  varying float vHeat;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float soft = pow(1.0 - smoothstep(0.0, 0.5, d), 1.8);
    float disk = 1.0 - smoothstep(0.4, 0.5, d);
    float ring = smoothstep(0.28, 0.46, d) * disk;
    float shape = mix(soft, disk * 0.5 + ring * 0.45, vBokeh);
    vec3 color = mix(vec3(1.0, 0.86, 0.62), vec3(1.0, 0.68, 0.34), max(vHeat, vBokeh * 0.6));
    gl_FragColor = vec4(color * 1.5, shape * vAlpha);
  }
`;

type DustParticlesProps = {
  count?: number;
};

export function DustParticles({ count = 460 }: DustParticlesProps) {
  const dpr = useThree((state) => state.viewport.dpr);
  const camera = useThree((state) => state.camera);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = Math.random() * 7.4;
      positions[i * 3 + 2] = (Math.random() - 0.55) * 11;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const origin = new THREE.Vector3(...BEAM_ORIGIN);
    const direction = new THREE.Vector3(...BEAM_TARGET).sub(origin).normalize();
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uAttract: { value: 0 },
        uBurst: { value: 0 },
        uFocus: { value: 10 },
        uBeamOrigin: { value: origin },
        uBeamDir: { value: direction },
        uBeamRadius: { value: BEAM_RADIUS_START },
        uBeamGrowth: { value: BEAM_RADIUS_GROWTH },
        uFlame: { value: new THREE.Vector3(...FLAME_POSITION) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, [count]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const uniforms = material.uniforms;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPixelRatio.value = dpr;
    uniforms.uAttract.value = ritualMotion.attract;
    uniforms.uBurst.value = ritualMotion.burst;
    uniforms.uFocus.value = camera.position.length();
  });

  return <points geometry={geometry} material={material} frustumCulled={false} layers={EFFECTS_LAYER} />;
}
