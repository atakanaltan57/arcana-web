"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BEAM_ORIGIN,
  BEAM_RADIUS_GROWTH,
  BEAM_RADIUS_START,
  BEAM_TARGET,
  EFFECTS_LAYER,
} from "@/lib/scene-constants";

const vertexShader = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  varying float vAlong;
  varying float vAround;
  void main() {
    vAlong = uv.y;
    vAround = uv.x;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  varying float vAlong;
  varying float vAround;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    float facing = abs(dot(normalize(vNormalView), normalize(-vViewPos)));
    float body = pow(facing, 2.2);
    float ends = smoothstep(0.12, 0.5, vAlong) * (1.0 - smoothstep(0.55, 1.0, vAlong));
    float streaks = 0.55 + 0.45 * noise(vec2(vAround * 26.0, vAlong * 2.0 - uTime * 0.05));
    float drift = 0.7 + 0.3 * noise(vec2(vAround * 6.0 + uTime * 0.03, vAlong * 5.0 - uTime * 0.12));
    float alpha = body * ends * streaks * drift * uStrength;
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.64) * alpha, alpha);
  }
`;

export function LightShaft() {
  const { geometry, material, position, quaternion } = useMemo(() => {
    const origin = new THREE.Vector3(...BEAM_ORIGIN);
    const target = new THREE.Vector3(...BEAM_TARGET);
    const length = origin.distanceTo(target);
    const geo = new THREE.CylinderGeometry(
      BEAM_RADIUS_START,
      BEAM_RADIUS_START + BEAM_RADIUS_GROWTH * length,
      length,
      48,
      1,
      true,
    );
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0.16 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const direction = target.clone().sub(origin).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
    const center = origin.clone().add(target).multiplyScalar(0.5);
    return { geometry: geo, material: mat, position: center, quaternion: rotation };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      quaternion={quaternion}
      frustumCulled={false}
      renderOrder={2}
      layers={EFFECTS_LAYER}
    />
  );
}
