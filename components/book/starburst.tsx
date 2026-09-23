"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { ritualMotion, ritualStore } from "@/lib/ritual-store";

export const starVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const starFragmentShader = /* glsl */ `
  uniform float uFlash;
  uniform float uSpin;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    float a = atan(p.y, p.x) + uSpin;
    float rays = pow(abs(cos(a * 2.0)), 60.0) + pow(abs(cos(a * 2.0 + 0.785)), 90.0) * 0.5;
    float falloff = exp(-r * 9.0);
    float core = exp(-r * r * 260.0);
    float intensity = (rays * falloff * 1.6 + core * 2.5 + exp(-r * 5.0) * 0.25) * uFlash;
    gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * intensity * 3.0, clamp(intensity, 0.0, 1.0));
  }
`;

type StarburstProps = {
  position: [number, number, number];
};

export function Starburst({ position }: StarburstProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(4.2, 4.2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      uniforms: { uFlash: { value: 0 }, uSpin: { value: 0 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
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
    const flash = ritualMotion.flash;
    material.uniforms.uFlash.value = flash;
    material.uniforms.uSpin.value = clock.elapsedTime * 0.4;
    if (mesh.current) mesh.current.visible = flash > 0.001;
  });

  return (
    <Billboard position={position}>
      <mesh ref={mesh} geometry={geometry} material={material} renderOrder={10} visible={false} />
    </Billboard>
  );
}

export function GemGlint({ position }: StarburstProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1.4, 1.4);
    const mat = new THREE.ShaderMaterial({
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      uniforms: { uFlash: { value: 0 }, uSpin: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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
    const { phase } = ritualStore.getSnapshot();
    const closed = phase === "idle" || phase === "charging";
    const t = clock.elapsedTime;
    const pulse = Math.pow(Math.max(0, Math.sin(t * 0.85)), 40) + Math.pow(Math.max(0, Math.sin(t * 1.9 + 1.7)), 90) * 0.5;
    const flash = closed ? 0.12 + pulse * 0.75 + ritualMotion.charge * 0.5 + ritualMotion.hover * 0.1 : 0;
    material.uniforms.uFlash.value = flash;
    material.uniforms.uSpin.value = 0.2 + Math.sin(t * 0.3) * 0.15;
    if (mesh.current) mesh.current.visible = flash > 0.001;
  });

  return (
    <Billboard position={position}>
      <mesh ref={mesh} geometry={geometry} material={material} renderOrder={9} />
    </Billboard>
  );
}
