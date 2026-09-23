"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { usePbrTextures } from "@/lib/textures/pbr";
import { canvasToTexture, createCanvas, seededRandom } from "@/lib/textures/procedural";

const HANDLE_REPEAT: [number, number] = [0.35, 1];
const IRON_REPEAT: [number, number] = [0.6, 0.6];
const HANDLE_LENGTH = 1.05;
const TILT = 0.32;
const COLLAR: [number, number, number] = [0, 0, 0.34];
const HEAD_TOP: [number, number, number] = [
  0,
  COLLAR[1] + Math.cos(TILT) * (HANDLE_LENGTH * 0.45 + 0.13),
  COLLAR[2] + Math.sin(TILT) * (HANDLE_LENGTH * 0.45 + 0.13),
];

const fireVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fireFragment = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  uniform float uCore;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }

  vec3 ramp(float h) {
    vec3 c = mix(vec3(0.28, 0.02, 0.0), vec3(0.95, 0.22, 0.02), smoothstep(0.0, 0.3, h));
    c = mix(c, vec3(1.0, 0.5, 0.08), smoothstep(0.25, 0.55, h));
    c = mix(c, vec3(1.0, 0.74, 0.28), smoothstep(0.55, 0.8, h));
    return mix(c, vec3(1.0, 0.88, 0.6), smoothstep(0.82, 1.0, h));
  }

  void main() {
    float t = uTime + uSeed * 13.0;
    vec2 uv = vec2((vUv.x - 0.5) * 2.0, vUv.y);
    float drift = (fbm(vec2(t * 0.4, uSeed * 3.0)) - 0.5) * 0.25 * uv.y;
    uv.x += drift;
    float n = fbm(vec2(uv.x * 2.6, uv.y * 3.4 - t * 3.2));
    float n2 = fbm(vec2(uv.x * 5.0 + 4.0, uv.y * 6.0 - t * 4.6));
    float taper = 1.0 - pow(abs(uv.x) * (1.15 + uv.y * 1.9), 1.6);
    float base = smoothstep(0.0, 0.12, uv.y);
    float f = (1.0 - uv.y) * 0.95 * taper + (n - 0.5) * (0.55 + uv.y * 0.9) + (n2 - 0.5) * 0.25;
    f *= base;
    float body = smoothstep(0.18, 0.5, f);
    float heat = smoothstep(0.25, 1.0, f) * mix(1.0, 1.25, uCore);
    vec3 color = ramp(clamp(heat, 0.0, 1.0)) * (0.55 + heat * 2.3);
    gl_FragColor = vec4(color * uIntensity, body * mix(0.85, 1.0, uCore));
  }
`;

const sparkVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vLife;
  void main() {
    float life = fract(uTime * (0.35 + aSeed * 0.4) + aSeed * 7.0);
    vLife = life;
    vec3 p = position;
    p.y += life * (1.2 + aSeed * 1.4);
    p.x += sin(life * 9.0 + aSeed * 40.0) * 0.12 * life + (aSeed - 0.5) * 0.4 * life;
    p.z += cos(life * 7.0 + aSeed * 30.0) * 0.1 * life;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.2 + aSeed * 1.8) * (1.0 - life * 0.7) * uPixelRatio * (16.0 / -mv.z);
  }
`;

const sparkFragment = /* glsl */ `
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(1.0 - smoothstep(0.0, 0.5, d), 1.6) * (1.0 - smoothstep(0.55, 1.0, vLife));
    vec3 c = mix(vec3(3.2, 1.5, 0.35), vec3(0.9, 0.15, 0.02), vLife);
    gl_FragColor = vec4(c, a);
  }
`;

function createEmberTexture(seed: number) {
  const size = 256;
  const rand = seededRandom(seed);
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 140; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 2 + rand() * 9;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(255,${120 + rand() * 90},30,${0.5 + rand() * 0.5})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = canvasToTexture(canvas, true);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

type TorchProps = {
  position: [number, number, number];
  dimAt: number | null;
  seed: number;
};

export function Torch({ position, dimAt, seed }: TorchProps) {
  const light = useRef<THREE.PointLight>(null);
  const dpr = useThree((state) => state.viewport.dpr);
  const handleTextures = usePbrTextures("medieval_wood", HANDLE_REPEAT);
  const ironTextures = usePbrTextures("rusty_metal_03", IRON_REPEAT);

  const assets = useMemo(() => {
    const makeFire = (fireSeed: number, core: number) =>
      new THREE.ShaderMaterial({
        vertexShader: fireVertex,
        fragmentShader: fireFragment,
        uniforms: { uTime: { value: 0 }, uSeed: { value: fireSeed }, uIntensity: { value: 1 }, uCore: { value: core } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    const outerFire = makeFire(seed * 3.1, 0);
    const innerFire = makeFire(seed * 5.7 + 2, 1);
    const embers = createEmberTexture(seed * 17);
    const handle = new THREE.MeshStandardMaterial({ ...handleTextures, color: "#6d5238", normalScale: new THREE.Vector2(1.2, 1.2) });
    const iron = new THREE.MeshStandardMaterial({ ...ironTextures, color: "#57493e", metalness: 0.7 });
    const head = new THREE.MeshStandardMaterial({
      color: "#1a120c",
      roughness: 0.95,
      emissive: new THREE.Color("#ff5a18"),
      emissiveMap: embers,
      emissiveIntensity: 1.6,
    });

    const sparkCount = 46;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkSeeds = new Float32Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i * 3] = (Math.random() - 0.5) * 0.1;
      sparkPositions[i * 3 + 1] = 0.05;
      sparkPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
      sparkSeeds[i] = Math.random();
    }
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    sparkGeometry.setAttribute("aSeed", new THREE.BufferAttribute(sparkSeeds, 1));
    const sparkMaterial = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const geometries = {
      plate: new THREE.BoxGeometry(0.26, 0.46, 0.04),
      arm: new THREE.BoxGeometry(0.05, 0.05, 0.32),
      collar: new THREE.TorusGeometry(0.06, 0.016, 8, 24),
      handle: new THREE.CylinderGeometry(0.042, 0.03, HANDLE_LENGTH, 20),
      head: new THREE.CylinderGeometry(0.085, 0.06, 0.26, 20),
      rivet: new THREE.SphereGeometry(0.018, 8, 8),
      outerFire: new THREE.PlaneGeometry(0.95, 1.35).translate(0, 0.58, 0),
      innerFire: new THREE.PlaneGeometry(0.55, 0.85).translate(0, 0.36, 0),
    };

    return {
      outerFire,
      innerFire,
      handle,
      iron,
      head,
      sparkGeometry,
      sparkMaterial,
      geometries,
      dispose: () => {
        [outerFire, innerFire, handle, iron, head, sparkMaterial].forEach((material) => material.dispose());
        embers.dispose();
        sparkGeometry.dispose();
        Object.values(geometries).forEach((geometry) => geometry.dispose());
      },
    };
  }, [handleTextures, ironTextures, seed]);

  useEffect(() => assets.dispose, [assets]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 3.7;
    const dimElapsed = dimAt === null ? Infinity : performance.now() - dimAt;
    const dim = dimElapsed < 1400 ? 1 - 0.8 * Math.sin((Math.PI * dimElapsed) / 1400) : 1;
    const flicker =
      0.82 + 0.1 * Math.sin(t * 9.3) * Math.sin(t * 5.1 + 1.2) + 0.08 * Math.sin(t * 17.7 + seed) + 0.05 * Math.sin(t * 31.3);
    for (const material of [assets.outerFire, assets.innerFire]) {
      material.uniforms.uTime.value = t;
      material.uniforms.uIntensity.value = dim * (0.9 + flicker * 0.2);
    }
    assets.sparkMaterial.uniforms.uTime.value = t;
    assets.sparkMaterial.uniforms.uPixelRatio.value = dpr;
    assets.head.emissiveIntensity = (1.2 + flicker * 0.8) * dim;
    if (light.current) light.current.intensity = 40 * flicker * dim;
  });

  const { geometries } = assets;

  return (
    <group position={position}>
      <mesh geometry={geometries.plate} material={assets.iron} position={[0, 0, 0.02]} />
      {[0.17, -0.17].map((y) => (
        <mesh key={y} geometry={geometries.rivet} material={assets.iron} position={[0, y, 0.045]} />
      ))}
      <mesh geometry={geometries.arm} material={assets.iron} position={[0, 0, 0.18]} />
      <mesh geometry={geometries.collar} material={assets.iron} position={COLLAR} rotation={[Math.PI / 2 - TILT, 0, 0]} />
      <group position={COLLAR} rotation={[TILT, 0, 0]}>
        <mesh geometry={geometries.handle} material={assets.handle} position={[0, HANDLE_LENGTH * 0.45 - HANDLE_LENGTH / 2, 0]} />
        <mesh geometry={geometries.head} material={assets.head} position={[0, HANDLE_LENGTH * 0.45, 0]} />
      </group>
      <group position={HEAD_TOP}>
        <Billboard>
          <mesh geometry={geometries.outerFire} material={assets.outerFire} renderOrder={7} />
          <mesh geometry={geometries.innerFire} material={assets.innerFire} position={[0, 0, 0.01]} renderOrder={8} />
        </Billboard>
        <points geometry={assets.sparkGeometry} material={assets.sparkMaterial} frustumCulled={false} />
      </group>
      <pointLight ref={light} position={[HEAD_TOP[0], HEAD_TOP[1] + 0.35, HEAD_TOP[2] + 0.15]} color="#ff8a3a" intensity={26} decay={2} />
    </group>
  );
}
