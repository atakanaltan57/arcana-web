"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { BookTheme } from "@/lib/themes";
import { createWoodTextures } from "@/lib/textures/wood-texture";
import { ritualMotion } from "@/lib/ritual-store";
import { BOOK_SIZE, BookModel } from "./book-model";
import { Candle } from "./candle";
import { DustParticles } from "./dust-particles";

const CLOSED_DIRECTION = new THREE.Vector3(0, 8.4, 6).normalize();
const OPEN_DIRECTION = new THREE.Vector3(0, 0.94, 0.34).normalize();
const FOV_TAN = Math.tan(THREE.MathUtils.degToRad(35 / 2));
const SPINE_X = -(BOOK_SIZE.width + BOOK_SIZE.overhang) / 2;
const PAGE_Y = BOOK_SIZE.coverThickness + BOOK_SIZE.pagesThickness / 2;

function CameraRig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const scratch = useMemo(
    () => ({
      closed: new THREE.Vector3(),
      opened: new THREE.Vector3(),
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      look: new THREE.Vector3(0, 0.2, 0.2),
    }),
    [],
  );

  const poses = useMemo(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const closedDistance = Math.max(10.3, 2.3 / (FOV_TAN * aspect));
    const wide = aspect >= 1.05;
    const halfWidth = wide ? 3.5 : 1.75;
    const openDistance = Math.max(2.55 / FOV_TAN, halfWidth / (FOV_TAN * aspect));
    const focusX = wide ? SPINE_X + 0.1 : 0.05;
    return { closedDistance, openDistance, focusX };
  }, [size.width, size.height]);

  useFrame((state, delta) => {
    const blend = ritualMotion.open;
    const push = 1 - ritualMotion.charge * 0.06;
    scratch.closed.copy(CLOSED_DIRECTION).multiplyScalar(poses.closedDistance * push);
    scratch.opened.copy(OPEN_DIRECTION).multiplyScalar(poses.openDistance);
    scratch.opened.x += poses.focusX;
    scratch.opened.y += PAGE_Y;
    scratch.position.lerpVectors(scratch.closed, scratch.opened, blend);
    const parallax = 1 - blend * 0.75;
    scratch.position.x += state.pointer.x * 0.35 * parallax;
    scratch.position.y += state.pointer.y * 0.2 * parallax;

    scratch.target.set(
      THREE.MathUtils.lerp(0, poses.focusX, blend),
      THREE.MathUtils.lerp(0.2, PAGE_Y, blend),
      THREE.MathUtils.lerp(0.25, 0.05, blend),
    );

    const lambda = blend > 0 && blend < 1 ? 8 : 3;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, scratch.position.x, lambda, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, scratch.position.y, lambda, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, scratch.position.z, lambda, delta);
    scratch.look.x = THREE.MathUtils.damp(scratch.look.x, scratch.target.x, lambda, delta);
    scratch.look.y = THREE.MathUtils.damp(scratch.look.y, scratch.target.y, lambda, delta);
    scratch.look.z = THREE.MathUtils.damp(scratch.look.z, scratch.target.z, lambda, delta);
    camera.lookAt(scratch.look);
  });

  return null;
}

function SceneCandle({ color }: { color: string }) {
  const size = useThree((state) => state.size);
  const wide = size.width / Math.max(size.height, 1) >= 1.2;
  return <Candle position={[-5.1, 0, -2.9]} color={color} showBody={wide} />;
}

function GlintLight() {
  const light = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    if (!light.current) return;
    const p = light.current.position;
    p.x = THREE.MathUtils.damp(p.x, 1.5 + state.pointer.x * 3, 3, delta);
    p.z = THREE.MathUtils.damp(p.z, 3.2 - state.pointer.y * 2, 3, delta);
  });

  return <pointLight ref={light} position={[1.5, 3.4, 3.2]} color="#ffe2b8" intensity={4.5} distance={10} decay={2} />;
}

function Table() {
  const wood = useMemo(() => createWoodTextures(), []);
  useEffect(() => wood.dispose, [wood]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial
        map={wood.map}
        normalMap={wood.normalMap}
        roughnessMap={wood.roughnessMap}
        roughness={1}
        metalness={0}
        envMapIntensity={0.35}
      />
    </mesh>
  );
}

type BookSceneProps = {
  theme: BookTheme;
  onReady: () => void;
};

export default function BookScene({ theme, onReady }: BookSceneProps) {
  const [dpr, setDpr] = useState(1.5);
  const [effects, setEffects] = useState(true);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 35, near: 0.1, far: 80, position: [0, 8.4, 6] }}
      onCreated={() => onReady()}
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
      <color attach="background" args={["#050608"]} />
      <fog attach="fog" args={["#050608", 16, 34]} />
      <CameraRig />

      <ambientLight intensity={0.05} color="#8090c0" />
      <directionalLight position={[5, 6, 6]} intensity={0.18} color="#9fb0ff" />
      <GlintLight />
      <SceneCandle color={theme.candle} />

      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={1.6} color="#ffcf98" position={[-3, 4, -4]} scale={[5, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2.4} color="#ffd9a8" position={[0, 5, -5]} scale={[8, 2, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={0.8} color="#ffe6c4" position={[3, 4, 2]} scale={2} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.3} color="#6d7fe0" position={[6, 2, 3]} scale={[2, 6, 1]} target={[0, 0, 0]} />
      </Environment>

      <Table />
      <BookModel theme={theme} />
      <ContactShadows position={[0, 0.002, 0]} opacity={0.9} scale={14} blur={2.2} far={1.6} resolution={1024} color="#000000" />
      <DustParticles color="#ffcf8a" />

      {effects && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.75} luminanceThreshold={1} luminanceSmoothing={0.25} />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Noise opacity={0.025} />
          <Vignette offset={0.3} darkness={0.8} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
