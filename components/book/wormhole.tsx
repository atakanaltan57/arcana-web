"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ritualMotion } from "@/lib/ritual-store";

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

const tunnelVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const tunnelFragment = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uTravel;
  uniform float uSpeed;
  varying vec3 vDir;
  ${noise}

  const float TAU = 6.2831853;

  float starLayer(vec2 q, vec2 cells, float seed, float stretch) {
    vec2 g = q * cells;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = wHash(id + seed);
    if (h < 0.86) return 0.0;
    vec2 offset = (vec2(wHash(id + seed + 3.1), wHash(id + seed + 7.7)) - 0.5) * 0.6;
    vec2 d = f - offset;
    d.y /= stretch;
    float core = exp(-dot(d, d) * 90.0);
    float halo = exp(-dot(d, d) * 14.0) * 0.12;
    return (core + halo) * pow((h - 0.86) / 0.14, 3.0);
  }

  float starfield(vec2 q, float stretch) {
    float s = starLayer(q, vec2(140.0, 5.0), 0.0, stretch);
    s += starLayer(q + vec2(0.37, 0.21), vec2(90.0, 3.2), 17.0, stretch) * 1.8;
    s += starLayer(q + vec2(0.11, 0.63), vec2(220.0, 8.0), 41.0, stretch) * 0.6;
    return s;
  }

  void main() {
    vec3 d = normalize(vDir);
    float theta = atan(length(d.xy), -d.z);
    float phi = atan(d.y, d.x);

    float exitRadius = mix(0.035, 1.35, pow(uTravel, 3.2));
    float nearThroat = exp(-max(theta - exitRadius, 0.0) * 3.2);
    float twist = uTime * 0.04 + 1.1 * nearThroat;
    float u = fract((phi + twist) / TAU);
    float depth = 1.0 / max(tan(theta * 0.5), 1e-3);
    float v = depth * 0.55 + uPhase;

    float stretch = 1.0 + uSpeed * 9.0;
    float aberration = 0.003 + uSpeed * 0.014;
    vec3 stars = vec3(
      starfield(vec2(u, v + aberration), stretch),
      starfield(vec2(u, v), stretch),
      starfield(vec2(u, v - aberration), stretch)
    );
    stars *= vec3(0.95, 0.97, 1.08);

    vec2 wall = vec2(cos(phi + twist), sin(phi + twist)) * 1.6;
    float dust = wFbm(wall + vec2(v * 0.22, -v * 0.15));
    float gas = wFbm(wall * 1.7 + vec2(-v * 0.35 + 11.0, v * 0.12 + 5.0));
    float lanes = smoothstep(0.35, 0.75, wFbm(wall * 3.1 + vec2(v * 0.6, 2.0)));
    vec3 color = vec3(0.012, 0.014, 0.024);
    color += vec3(0.09, 0.11, 0.2) * pow(gas, 2.2) * 0.9;
    color += vec3(0.38, 0.22, 0.11) * pow(dust, 3.0) * 0.8;
    color *= 1.0 - lanes * 0.75;
    color += stars * (1.0 - lanes * 0.6) * 2.4;

    float spill = exp(-max(theta - exitRadius, 0.0) * 5.0);
    color += vec3(1.0, 0.62, 0.3) * spill * (0.25 + uTravel * 0.6);

    float ringWidth = 0.004 + exitRadius * 0.01;
    vec3 ring = vec3(
      exp(-pow((theta - exitRadius * 1.02) / ringWidth, 2.0)),
      exp(-pow((theta - exitRadius * 1.03) / ringWidth, 2.0)),
      exp(-pow((theta - exitRadius * 1.04) / ringWidth, 2.0))
    );
    color += ring * vec3(1.3, 1.15, 1.0) * (0.6 + 0.4 * wFbm(vec2(phi * 4.0, uTime)));

    float inside = 1.0 - smoothstep(exitRadius * 0.45, exitRadius * 1.0, theta);
    float haze = wFbm(vec2(cos(phi) * 3.0 + theta * 9.0, sin(phi) * 3.0 - uTime * 0.25));
    float core = exp(-theta / max(exitRadius, 1e-3) * 2.2);
    vec3 beyond = mix(vec3(0.75, 0.46, 0.24), vec3(1.7, 1.42, 1.1), core);
    beyond *= 0.7 + haze * 0.55;
    color = mix(color, color * 0.35 + beyond, inside);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function blackHoleScale(vortex: number) {
  return 0.04 + vortex * 5.36;
}

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
    material.uniforms.uOpen.value = Math.min(1, 0.45 + open * 3);
    if (mesh.current) {
      mesh.current.visible = open > 0;
      const size = blackHoleScale(open);
      mesh.current.scale.set(size, 1, size);
    }
  });

  return <mesh ref={mesh} geometry={geometry} material={material} position={position} renderOrder={6} visible={false} />;
}

export function WormholeTunnel() {
  const mesh = useRef<THREE.Mesh>(null);
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.SphereGeometry(30, 64, 32);
    const mat = new THREE.ShaderMaterial({
      vertexShader: tunnelVertex,
      fragmentShader: tunnelFragment,
      uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uTravel: { value: 0 }, uSpeed: { value: 0 } },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
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

  useFrame(({ clock, camera }, delta) => {
    const tunnel = ritualMotion.tunnel;
    const speed = Math.min(1, 0.15 + tunnel * tunnel * 1.1);
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uTravel.value = tunnel;
    material.uniforms.uSpeed.value = speed;
    material.uniforms.uPhase.value += delta * (0.6 + speed * speed * 7);
    if (mesh.current) {
      mesh.current.visible = tunnel > 0;
      mesh.current.position.copy(camera.position);
    }
  });

  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={-10} frustumCulled={false} visible={false} />;
}
