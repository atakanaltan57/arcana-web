"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ritualMotion } from "@/lib/ritual-store";
import { TUNNEL_LENGTH, TUNNEL_ORIGIN, TUNNEL_RADIUS } from "@/lib/scene-constants";

const noise = /* glsl */ `
  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float wFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * wNoise(p); p *= 2.07; a *= 0.5; }
    return v;
  }
`;

const passVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const vortexFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpen;
  varying vec2 vUv;
  ${noise}

  vec3 blackbody(float t) {
    vec3 c = mix(vec3(0.45, 0.04, 0.0), vec3(1.0, 0.32, 0.04), smoothstep(0.0, 0.35, t));
    c = mix(c, vec3(1.0, 0.72, 0.32), smoothstep(0.3, 0.65, t));
    c = mix(c, vec3(1.0, 0.94, 0.82), smoothstep(0.65, 0.9, t));
    return mix(c, vec3(0.82, 0.9, 1.0), smoothstep(0.9, 1.0, t));
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.y, p.x);

    float horizon = 0.22;
    float photon = 0.265;
    float inner = 0.3;

    float omega = 1.6 / pow(max(r, inner), 1.5);
    float swirlAngle = a - uTime * omega;
    float streaks = wFbm(vec2(swirlAngle * 3.0 + r * 4.0, r * 22.0));
    float filaments = wFbm(vec2(swirlAngle * 9.0 - r * 3.0, r * 60.0 + uTime * 0.2));
    float turbulence = mix(streaks, filaments, 0.35);

    float diskMask = smoothstep(inner - 0.02, inner + 0.06, r) * (1.0 - smoothstep(0.62, 1.0, r));
    float temperature = clamp(pow(inner / max(r, inner), 1.6) * (0.55 + turbulence * 0.8), 0.0, 1.0);
    float doppler = 1.0 + 0.75 * sin(a - 0.6);
    float emission = diskMask * (0.35 + turbulence * 1.3) * doppler * pow(inner / max(r, inner), 1.2);
    vec3 color = blackbody(temperature) * emission * 3.2;

    float ring = exp(-pow((r - photon) / 0.012, 2.0));
    color += vec3(1.0, 0.9, 0.75) * ring * (2.6 + 1.2 * doppler);

    float glow = exp(-pow((r - photon) / 0.07, 2.0)) * 0.3;
    color += vec3(1.0, 0.42, 0.1) * glow * doppler;

    float shadow = 1.0 - smoothstep(horizon - 0.01, horizon + 0.012, r);
    color *= 1.0 - shadow;

    float alpha = max(shadow, clamp(emission * 1.4 + ring + glow, 0.0, 1.0));
    alpha *= uOpen;
    gl_FragColor = vec4(color * uOpen, alpha);
  }
`;

const tunnelFragment = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  ${noise}
  void main() {
    float around = vUv.x + vUv.y * 1.6 + uTime * 0.12;
    float along = vUv.y * 60.0 + uPhase;
    vec2 cell = vec2(floor(around * 90.0), floor(along));
    float star = step(0.93, wHash(cell));
    float streak = star * smoothstep(0.0, 0.5, fract(along)) * (1.0 - smoothstep(0.5, 1.0, fract(along)));
    streak *= 1.0 - smoothstep(0.2, 0.5, abs(fract(around * 90.0) - 0.5));
    float ring = 6.2831853 * (vUv.x + vUv.y * 1.6 + uTime * 0.12);
    float nebula = 0.5 * (wFbm(vec2(sin(ring) * 2.0 + 3.0, vUv.y * 8.0 + uTime * 0.6)) + wFbm(vec2(cos(ring) * 2.0 + 7.0, vUv.y * 8.0 - uTime * 0.4)));
    vec3 color = mix(vec3(0.03, 0.04, 0.16), vec3(0.28, 0.2, 0.55), nebula);
    color += vec3(0.9, 0.6, 0.25) * pow(nebula, 3.0) * 1.4;
    color += vec3(3.4, 2.4, 1.1) * streak;
    float depthGlow = smoothstep(0.2, 1.0, vUv.y);
    color += vec3(1.6, 1.3, 0.9) * pow(depthGlow, 6.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

type VortexDiscProps = {
  position: [number, number, number];
};

export function VortexDisc({ position }: VortexDiscProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: passVertex,
      fragmentShader: vortexFragment,
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
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

  useFrame(({ clock }) => {
    const open = ritualMotion.vortex;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uOpen.value = Math.min(1, open * 1.6);
    if (mesh.current) {
      mesh.current.visible = open > 0.001;
      const size = 0.2 + open * 5.2;
      mesh.current.scale.set(size, 1, size);
    }
  });

  return <mesh ref={mesh} geometry={geometry} material={material} position={position} renderOrder={6} visible={false} />;
}

export function WormholeTunnel() {
  const mesh = useRef<THREE.Mesh>(null);
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.CylinderGeometry(TUNNEL_RADIUS * 0.35, TUNNEL_RADIUS, TUNNEL_LENGTH, 64, 1, true).rotateX(
      -Math.PI / 2,
    );
    const mat = new THREE.ShaderMaterial({
      vertexShader: passVertex,
      fragmentShader: tunnelFragment,
      uniforms: { uTime: { value: 0 }, uPhase: { value: 0 } },
      side: THREE.BackSide,
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

  useFrame(({ clock }, delta) => {
    const tunnel = ritualMotion.tunnel;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPhase.value += delta * (6 + tunnel * tunnel * 40);
    if (mesh.current) mesh.current.visible = tunnel > 0;
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      position={[TUNNEL_ORIGIN[0], TUNNEL_ORIGIN[1], TUNNEL_ORIGIN[2] - TUNNEL_LENGTH / 2]}
      frustumCulled={false}
      visible={false}
    />
  );
}
