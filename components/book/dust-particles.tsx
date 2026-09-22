"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ritualMotion } from "@/lib/ritual-store";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uAttract;
  uniform float uBurst;
  attribute float aSeed;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float t = uTime * 0.1 + aSeed * 20.0;
    p.x += sin(t * 1.3 + aSeed * 6.0) * 0.4;
    p.z += cos(t * 1.1 + aSeed * 4.0) * 0.4;
    p.y = mod(p.y + uTime * 0.04 * (0.4 + aSeed), 4.5) + 0.15;

    vec3 center = vec3(0.0, 0.7, 0.0);
    vec3 toCenter = center - p;
    float pull = uAttract * (0.45 + 0.55 * aSeed);
    float swirl = uAttract * 2.4 + aSeed * 6.28;
    vec3 orbit = center + vec3(cos(swirl + uTime * 2.0), 0.15 * sin(uTime * 3.0 + aSeed * 9.0), sin(swirl + uTime * 2.0)) * (0.35 + aSeed * 1.8);
    p = mix(p, orbit, pull * 0.92);
    p += normalize(p - center + 0.001) * uBurst * (1.5 + aSeed * 2.5);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.6 + aSeed * 1.5) * (1.0 + uAttract * 0.8) * uPixelRatio * (22.0 / -mv.z);

    float twinkle = 0.3 + 0.7 * abs(sin(uTime * 0.7 + aSeed * 31.0));
    vAlpha = twinkle * smoothstep(0.1, 0.9, p.y) * smoothstep(5.0, 3.6, p.y) * (0.55 + uAttract * 1.6 + uBurst);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.8);
    gl_FragColor = vec4(uColor * 1.6, a * vAlpha);
  }
`;

type DustParticlesProps = {
  count?: number;
  color: string;
};

export function DustParticles({ count = 320, color }: DustParticlesProps) {
  const dpr = useThree((state) => state.viewport.dpr);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 11;
      positions[i * 3 + 1] = Math.random() * 4.5;
      positions[i * 3 + 2] = (Math.random() - 0.55) * 8;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uAttract: { value: 0 },
        uBurst: { value: 0 },
        uColor: { value: new THREE.Color(color) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, [count, color]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = dpr;
    material.uniforms.uAttract.value = ritualMotion.attract;
    material.uniforms.uBurst.value = ritualMotion.burst;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
