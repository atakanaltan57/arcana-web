"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { ritualMotion } from "@/lib/ritual-store";

const flameVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float sway = sin(uTime * 3.1) * 0.5 + sin(uTime * 7.3) * 0.3 + sin(uTime * 13.7) * 0.2;
    p.x += sway * 0.03 * pow(uv.y, 2.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const flameFragment = /* glsl */ `
  uniform float uTime;
  uniform float uBoost;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - vec2(0.5, 0.28);
    float flick = 1.0 + 0.08 * sin(uTime * 17.0) + 0.05 * sin(uTime * 29.0);
    p.y /= mix(1.0, 2.6, smoothstep(-0.1, 0.6, p.y)) * flick;
    float d = length(p * vec2(2.4, 1.3));
    float body = smoothstep(0.34, 0.0, d);
    float core = smoothstep(0.16, 0.0, length((vUv - vec2(0.5, 0.24)) * vec2(3.2, 1.8)));
    float blueBase = smoothstep(0.1, 0.0, length((vUv - vec2(0.5, 0.12)) * vec2(3.0, 3.0)));
    vec3 color = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.8, 0.45), body);
    color = mix(color, vec3(1.0, 0.97, 0.88), core);
    color = mix(color, vec3(0.25, 0.35, 1.0), blueBase * 0.5);
    float alpha = clamp(body * 1.2 + core, 0.0, 1.0);
    gl_FragColor = vec4(color * (3.2 + uBoost * 2.0), alpha);
  }
`;

const haloFragment = /* glsl */ `
  uniform float uBoost;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.4);
    gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * (0.9 + uBoost), a * 0.55);
  }
`;

export function candleFlicker(t: number) {
  return 1 + 0.07 * Math.sin(t * 7.1) + 0.05 * Math.sin(t * 12.7 + 1.3) + 0.035 * Math.sin(t * 23.3 + 0.5);
}

type CandleProps = {
  position: [number, number, number];
  color: string;
  showBody: boolean;
};

export function Candle({ position, color, showBody }: CandleProps) {
  const light = useRef<THREE.PointLight>(null);
  const height = 1.5;
  const radius = 0.26;

  const assets = useMemo(() => {
    const waxProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(radius, 0),
      new THREE.Vector2(radius * 1.01, height * 0.6),
      new THREE.Vector2(radius * 0.98, height * 0.97),
      new THREE.Vector2(radius * 0.93, height),
      new THREE.Vector2(radius * 0.6, height - 0.035),
      new THREE.Vector2(0.02, height - 0.06),
      new THREE.Vector2(0, height - 0.06),
    ];
    const wax = new THREE.LatheGeometry(waxProfile, 48);
    const holderProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.62, 0),
      new THREE.Vector2(0.66, 0.03),
      new THREE.Vector2(0.62, 0.07),
      new THREE.Vector2(0.34, 0.09),
      new THREE.Vector2(0.3, 0.2),
      new THREE.Vector2(0.28, 0.22),
      new THREE.Vector2(0, 0.22),
    ];
    const holder = new THREE.LatheGeometry(holderProfile, 48);
    const wick = new THREE.CylinderGeometry(0.008, 0.012, 0.12, 8);
    const flamePlane = new THREE.PlaneGeometry(0.2, 0.46);
    const haloPlane = new THREE.PlaneGeometry(1.8, 1.8);

    const waxMaterial = new THREE.MeshStandardMaterial({
      color: "#e8dcc4",
      roughness: 0.55,
      emissive: new THREE.Color("#ff8a3d"),
      emissiveIntensity: 0.06,
    });
    const brass = new THREE.MeshStandardMaterial({ color: "#a47a3c", metalness: 1, roughness: 0.32 });
    const wickMaterial = new THREE.MeshStandardMaterial({ color: "#1a120c", roughness: 1 });
    const uniforms = { uTime: { value: 0 }, uBoost: { value: 0 } };
    const flameMaterial = new THREE.ShaderMaterial({
      vertexShader: flameVertex,
      fragmentShader: flameFragment,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const haloMaterial = new THREE.ShaderMaterial({
      vertexShader: flameVertex,
      fragmentShader: haloFragment,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return {
      wax,
      holder,
      wick,
      flamePlane,
      haloPlane,
      waxMaterial,
      brass,
      wickMaterial,
      flameMaterial,
      haloMaterial,
      uniforms,
    };
  }, []);

  useEffect(
    () => () => {
      [assets.wax, assets.holder, assets.wick, assets.flamePlane, assets.haloPlane].forEach((g) => g.dispose());
      [assets.waxMaterial, assets.brass, assets.wickMaterial, assets.flameMaterial, assets.haloMaterial].forEach((m) =>
        m.dispose(),
      );
    },
    [assets],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const boost = ritualMotion.charge * 0.8 + ritualMotion.burst * 0.6;
    assets.uniforms.uTime.value = t;
    assets.uniforms.uBoost.value = boost;
    if (light.current) {
      light.current.intensity = 60 * candleFlicker(t) * (1 + boost * 0.5);
      light.current.position.x = Math.sin(t * 3.1) * 0.03;
    }
  });

  const flameY = 0.22 + height + 0.12;

  return (
    <group position={position}>
      <group visible={showBody}>
        <mesh geometry={assets.holder} material={assets.brass} />
        <mesh geometry={assets.wax} material={assets.waxMaterial} position={[0, 0.22, 0]} />
        <mesh geometry={assets.wick} material={assets.wickMaterial} position={[0, 0.22 + height - 0.02, 0]} />
        <Billboard position={[0, flameY, 0]}>
          <mesh geometry={assets.haloPlane} material={assets.haloMaterial} />
          <mesh geometry={assets.flamePlane} material={assets.flameMaterial} position={[0, 0.08, 0.01]} />
        </Billboard>
      </group>
      <pointLight ref={light} position={[0, flameY + 0.1, 0]} color={color} intensity={34} decay={2} />
    </group>
  );
}
