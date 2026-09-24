"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { LoadProgressBridge } from "@/components/brand/load-progress-bridge";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { GATE, sealPlacement } from "@/lib/gate-layout";
import { SEAL_COUNT } from "@/lib/seals";
import { clamp01, easeInOutCubic } from "@/lib/easing";
import { GateArchitecture } from "./gate-architecture";
import { DOOR_OPEN_MS, GateDoors } from "./gate-doors";
import { SealSocket, useSealAssets } from "./seal-socket";
import { Torch } from "./torch";

export type SealBreak = { index: number; at: number };

type GateSceneProps = {
  broken: number[];
  breaking: SealBreak | null;
  openAt: number | null;
  dimAt: number | null;
  onReady: () => void;
};

const FOCUS_MS = 2800;
const LOOK_BASE = new THREE.Vector3(0, 3.7, 0);

function GateCamera({ breaking, openAt, dimAt }: Pick<GateSceneProps, "breaking" | "openAt" | "dimAt">) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const scratch = useMemo(() => ({ position: new THREE.Vector3(), look: LOOK_BASE.clone(), target: new THREE.Vector3() }), []);

  const distance = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const halfFov = THREE.MathUtils.degToRad(22.5);
    return Math.max(12, 4.4 / (Math.tan(halfFov) * aspect), 5 / Math.tan(halfFov));
  }, [size.width, size.height]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const intro = easeInOutCubic(Math.min(1, t / 4));
    scratch.position.set(state.pointer.x * 0.6, 3.1 + state.pointer.y * 0.3, distance * (1.12 - intro * 0.12));
    scratch.target.copy(LOOK_BASE);

    if (breaking) {
      const elapsed = performance.now() - breaking.at;
      if (elapsed < FOCUS_MS) {
        const weight = Math.sin(Math.PI * clamp01(elapsed / FOCUS_MS));
        const seal = new THREE.Vector3(...sealPlacement(breaking.index).position);
        scratch.position.lerp(seal.clone().add(new THREE.Vector3(0, -0.4, 4)), weight * 0.8);
        scratch.target.lerp(seal, weight);
      }
    }
    if (openAt !== null) {
      const push = easeInOutCubic(clamp01((performance.now() - openAt - DOOR_OPEN_MS * 0.35) / (DOOR_OPEN_MS * 1.1)));
      scratch.position.lerp(new THREE.Vector3(0, 3, 1.2), push);
      scratch.target.lerp(new THREE.Vector3(0, 3, -4), push);
    }
    if (dimAt !== null) {
      const since = performance.now() - dimAt;
      if (since < 700) scratch.position.x += Math.sin(since * 0.09) * 0.05 * (1 - since / 700);
    }

    camera.position.x = THREE.MathUtils.damp(camera.position.x, scratch.position.x, 3, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, scratch.position.y, 3, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, scratch.position.z, 3, delta);
    scratch.look.x = THREE.MathUtils.damp(scratch.look.x, scratch.target.x, 3, delta);
    scratch.look.y = THREE.MathUtils.damp(scratch.look.y, scratch.target.y, 3, delta);
    scratch.look.z = THREE.MathUtils.damp(scratch.look.z, scratch.target.z, 3, delta);
    camera.lookAt(scratch.look);
  });

  return null;
}

const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - uTime * 0.05 * (0.3 + aSeed), 9.0);
    p.x += sin(uTime * 0.2 + aSeed * 40.0) * 0.4;
    p.z += cos(uTime * 0.17 + aSeed * 30.0) * 0.4;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.8 + aSeed * 1.6) * uPixelRatio * (20.0 / -mv.z);
    float torch = max(1.0 / (1.0 + pow(length(p - vec3(-3.75, 3.7, 0.2)), 2.0)), 1.0 / (1.0 + pow(length(p - vec3(3.75, 3.7, 0.2)), 2.0)));
    vAlpha = (0.15 + torch * 1.8) * (0.5 + 0.5 * sin(uTime * 0.8 + aSeed * 60.0));
  }
`;

const dustFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0);
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * 1.4, a * vAlpha);
  }
`;

function CryptDust() {
  const dpr = useThree((state) => state.viewport.dpr);
  const { geometry, material } = useMemo(() => {
    const count = 420;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = Math.random() * 9;
      positions[i * 3 + 2] = Math.random() * 9 - 1;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
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
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = dpr;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function Seals({ broken, breaking }: Pick<GateSceneProps, "broken" | "breaking">) {
  const assets = useSealAssets();
  return (
    <>
      {Array.from({ length: SEAL_COUNT }, (_, index) => (
        <SealSocket
          key={index}
          index={index}
          broken={broken.includes(index)}
          breakAt={breaking?.index === index ? breaking.at : null}
          assets={assets}
        />
      ))}
    </>
  );
}

export default function GateScene({ broken, breaking, openAt, dimAt, onReady }: GateSceneProps) {
  const [dpr, setDpr] = useState(1.5);
  const [effects, setEffects] = useState(true);
  const torchY = GATE.springY - 1.5;

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 45, near: 0.1, far: 80, position: [0, 3.2, 14] }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
        onDecline={() => setDpr(1)}
        flipflops={3}
        onFallback={() => {
          setDpr(1);
          setEffects(false);
        }}
      />
      <color attach="background" args={["#040406"]} />
      <fog attach="fog" args={["#07070a", 18, 42]} />
      <GateCamera breaking={breaking} openAt={openAt} dimAt={dimAt} />

      <ambientLight intensity={0.22} color="#8a8fb0" />
      <directionalLight position={[0, 9, 8]} intensity={0.45} color="#b8c0ff" />
      <pointLight position={[0, 6.6, 5]} intensity={30} color="#ffb27a" decay={2} />
      <pointLight position={[0, 1.2, 6]} intensity={12} color="#ff9a5a" decay={2} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.8} color="#ffb070" position={[-5, 4, 4]} scale={[3, 3, 1]} target={[0, 3, 0]} />
        <Lightformer form="rect" intensity={1.8} color="#ffb070" position={[5, 4, 4]} scale={[3, 3, 1]} target={[0, 3, 0]} />
        <Lightformer form="rect" intensity={0.3} color="#5a66c8" position={[0, 10, 6]} scale={[10, 2, 1]} target={[0, 3, 0]} />
      </Environment>

      <Suspense fallback={null}>
        <GateArchitecture />
        <GateDoors openAt={openAt} awakened={broken.length / SEAL_COUNT} />
        <Seals broken={broken} breaking={breaking} />
        <Torch position={[-(GATE.archOuter + 0.6), torchY, -0.33]} dimAt={dimAt} seed={1} />
        <Torch position={[GATE.archOuter + 0.6, torchY, -0.33]} dimAt={dimAt} seed={2} />
        <ReadySignal onReady={onReady} />
      </Suspense>
      <CryptDust />

      {effects && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1} luminanceSmoothing={0.25} />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Noise opacity={0.03} />
          <Vignette offset={0.3} darkness={0.62} />
        </EffectComposer>
      )}
      <LoadProgressBridge />
    </Canvas>
  );
}
