"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LoadProgressBridge } from "@/components/brand/load-progress-bridge";
import { HeatHazeEffect, HeatTracker } from "./heat-haze";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { createWoodTextures } from "@/lib/textures/wood-texture";
import { usePbrTextures } from "@/lib/textures/pbr";
import { playRustle } from "@/lib/sound";
import { ritualMotion } from "@/lib/ritual-store";
import { BOOK_SIZE, BookModel, ClosedBook, DROP_CAP_WORLD, RIGHT_PAGE } from "./book-model";
import { BOOKS, findBook } from "@/lib/books";
import { ritualStore } from "@/lib/ritual-store";
import { WormholeTunnel } from "./wormhole";
import { BlackHoleLensEffect, LensTracker } from "./black-hole-lens";
import { Candle } from "./candle";
import { DustParticles } from "./dust-particles";
import { LightShaft } from "./light-shaft";
import { CANDLE_POSITION, EFFECTS_LAYER, TUNNEL_ORIGIN } from "@/lib/scene-constants";

const CLOSED_DIRECTION = new THREE.Vector3(0, 8.4, 6).normalize();
const OPEN_DIRECTION = new THREE.Vector3(0, 0.94, 0.34).normalize();
const FOV_TAN = Math.tan(THREE.MathUtils.degToRad(35 / 2));
const CLOSED_MIN_DISTANCE = 12.2;
const SPINE_X = -(BOOK_SIZE.width + BOOK_SIZE.overhang) / 2;
const PAGE_Y = BOOK_SIZE.coverThickness + BOOK_SIZE.pagesThickness / 2;

function closedDistanceFor(width: number, height: number) {
  const aspect = width / Math.max(height, 1);
  const hudReserve = THREE.MathUtils.clamp(310 / Math.max(height, 1), 0.3, 0.58);
  return Math.max(CLOSED_MIN_DISTANCE, 2.3 / (FOV_TAN * aspect), 2.6 / (FOV_TAN * (1 - hudReserve)));
}

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

  useEffect(() => {
    camera.layers.enable(EFFECTS_LAYER);
  }, [camera]);

  const poses = useMemo(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const closedDistance = closedDistanceFor(size.width, size.height);
    const wide = aspect >= 1.05;
    const halfWidth = wide ? 3.5 : 1.56;
    const openDistance = Math.max(2.55 / FOV_TAN, halfWidth / (FOV_TAN * aspect));
    const focusX = wide ? SPINE_X + 0.1 : 0.06;
    const openZ = wide ? 0 : aspect < 0.62 ? 0.6 : 0.25;
    return { closedDistance, openDistance, focusX, openZ };
  }, [size.width, size.height]);

  useFrame((state, delta) => {
    const perspective = camera as THREE.PerspectiveCamera;
    if (ritualMotion.tunnel > 0) {
      const travel = ritualMotion.tunnel;
      const shake = Math.sin(state.clock.elapsedTime * 43) * 0.05 * travel;
      camera.position.set(TUNNEL_ORIGIN[0] + shake, TUNNEL_ORIGIN[1] + shake * 0.6, TUNNEL_ORIGIN[2] + 1 - travel * travel * 60);
      camera.lookAt(TUNNEL_ORIGIN[0], TUNNEL_ORIGIN[1], camera.position.z - 20);
      camera.rotateZ(travel * travel * 0.9 + Math.sin(state.clock.elapsedTime * 0.7) * 0.04);
      perspective.fov = 70 + travel * 25;
      perspective.updateProjectionMatrix();
      return;
    }
    const dive = ritualMotion.dive;
    const targetFov = 35 + dive * 40;
    if (Math.abs(perspective.fov - targetFov) > 0.01) {
      perspective.fov = dive > 0 ? targetFov : THREE.MathUtils.damp(perspective.fov, 35, 4, delta);
      perspective.updateProjectionMatrix();
    }
    const blend = ritualMotion.open;
    const push = 1 - ritualMotion.charge * 0.06;
    scratch.closed.copy(CLOSED_DIRECTION).multiplyScalar(poses.closedDistance * push);
    scratch.opened.copy(OPEN_DIRECTION).multiplyScalar(poses.openDistance);
    scratch.opened.x += poses.focusX;
    scratch.opened.y += PAGE_Y;
    scratch.opened.z += poses.openZ;
    scratch.position.lerpVectors(scratch.closed, scratch.opened, blend);
    const parallax = 1 - blend * 0.75;
    scratch.position.x += state.pointer.x * 0.35 * parallax;
    scratch.position.y += state.pointer.y * 0.2 * parallax;

    scratch.target.set(
      THREE.MathUtils.lerp(0, poses.focusX, blend),
      THREE.MathUtils.lerp(0.2, PAGE_Y, blend),
      0.05 + poses.openZ * blend,
    );

    if (dive > 0) {
      const k = Math.pow(dive, 1.4);
      scratch.position.lerp(new THREE.Vector3(DROP_CAP_WORLD[0], DROP_CAP_WORLD[1] + 0.3, DROP_CAP_WORLD[2] + 0.05), k);
      scratch.target.lerp(new THREE.Vector3(...DROP_CAP_WORLD), Math.min(1, dive * 1.5));
      camera.position.copy(scratch.position);
      scratch.look.copy(scratch.target);
      camera.lookAt(scratch.look);
      return;
    }
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

function BookCarousel({ bookId }: { bookId: string }) {
  const size = useThree((state) => state.size);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const active = useRef<THREE.Group>(null);
  const index = Math.max(0, BOOKS.findIndex((book) => book.id === bookId));
  const scroll = useRef(index);
  const spread = useRef(1);
  const lastIndex = useRef(index);

  const spacing = useMemo(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const halfVisible = closedDistanceFor(size.width, size.height) * FOV_TAN * aspect;
    return THREE.MathUtils.clamp(halfVisible * 0.95 + 1, 3.6, 4.6);
  }, [size.width, size.height]);

  useEffect(() => {
    if (lastIndex.current !== index) playRustle(0.6);
    lastIndex.current = index;
  }, [index]);

  useEffect(
    () => () => {
      ritualMotion.swapping = false;
    },
    [],
  );

  const place = (node: THREE.Group, offset: number, spreadFactor: number) => {
    const distance = Math.min(Math.abs(offset), 1.6);
    node.position.set(offset * spacing * spreadFactor, 0, -distance * 0.9);
    node.rotation.set(0, -THREE.MathUtils.clamp(offset, -1, 1) * 0.32, 0);
    node.scale.setScalar(1 - Math.min(distance, 1) * 0.1);
  };

  useFrame((_, delta) => {
    const idle = ritualStore.getSnapshot().phase === "idle";
    const target = index + (idle ? ritualMotion.carouselDrag : 0);
    const dragging = ritualMotion.carouselDrag !== 0;
    scroll.current = dragging ? THREE.MathUtils.damp(scroll.current, target, 18, delta) : THREE.MathUtils.damp(scroll.current, target, 7, delta);
    spread.current = THREE.MathUtils.damp(spread.current, idle ? 1 : 3.2, 3, delta);
    ritualMotion.swapping = dragging || Math.abs(scroll.current - index) > 0.03;

    BOOKS.forEach((_, i) => {
      const node = groups.current[i];
      if (!node) return;
      const offset = i - scroll.current;
      node.visible = i !== index && Math.abs(offset * spread.current) < 2.6;
      if (node.visible) place(node, offset, spread.current);
    });
    if (active.current) place(active.current, index - scroll.current, 1);
  });

  return (
    <>
      {BOOKS.map((book, i) => (
        <group
          key={book.id}
          ref={(node) => {
            groups.current[i] = node;
          }}
          visible={false}
        >
          {i !== index && <ClosedBook theme={book.theme} />}
        </group>
      ))}
      <group ref={active}>
        <BookModel theme={BOOKS[index].theme} />
      </group>
    </>
  );
}

function SceneCandle({ color }: { color: string }) {
  const size = useThree((state) => state.size);
  const wide = size.width / Math.max(size.height, 1) >= 1.2;
  return <Candle position={CANDLE_POSITION} color={color} showBody={wide} />;
}

function PageTracker() {
  const camera = useThree((state) => state.camera);
  const corners = useMemo(
    () =>
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(
        ([sx, sz]) =>
          new THREE.Vector3(RIGHT_PAGE.centerX + sx * RIGHT_PAGE.halfWidth, RIGHT_PAGE.y, sz * RIGHT_PAGE.halfDepth),
      ),
    [],
  );
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const rect = ritualMotion.pageRect;
    rect.visible = ritualMotion.open > 0.98;
    if (!rect.visible) return;
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const corner of corners) {
      projected.copy(corner).project(camera);
      const x = (projected.x + 1) / 2;
      const y = (1 - projected.y) / 2;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    rect.left = left;
    rect.right = right;
    rect.top = top;
    rect.bottom = bottom;
  });

  return null;
}

function GlintLight() {
  const light = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    if (!light.current) return;
    const p = light.current.position;
    p.x = THREE.MathUtils.damp(p.x, 1.5 + state.pointer.x * 3, 3, delta);
    p.z = THREE.MathUtils.damp(p.z, 3.2 - state.pointer.y * 2, 3, delta);
    ritualMotion.glint[0] = p.x;
    ritualMotion.glint[1] = p.y;
    ritualMotion.glint[2] = p.z;
  });

  return <pointLight ref={light} position={[1.5, 3.4, 3.2]} color="#ffe2b8" intensity={4.5} decay={2} />;
}

const TABLE_REPEAT: [number, number] = [4, 4];

function Table() {
  const wood = usePbrTextures("wood_table_001", TABLE_REPEAT, Math.PI / 2);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial
        map={wood.map}
        normalMap={wood.normalMap}
        normalScale={[1.2, 1.2]}
        color="#e0ae84"
        roughness={0.82}
        metalness={0}
        envMapIntensity={0.06}
      />
    </mesh>
  );
}

function ProceduralTable() {
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
        envMapIntensity={0.1}
      />
    </mesh>
  );
}

type BookSceneProps = {
  bookId: string;
  onReady: () => void;
  onContextLost: () => void;
};

type TableBoundaryState = { failed: boolean };

class TableBoundary extends Component<{ children: ReactNode }, TableBoundaryState> {
  state: TableBoundaryState = { failed: false };

  static getDerivedStateFromError(): TableBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Table textures failed; using procedural table", error);
  }

  render() {
    return this.state.failed ? <ProceduralTable /> : this.props.children;
  }
}

export default function BookScene({ bookId, onReady, onContextLost }: BookSceneProps) {
  const theme = findBook(bookId).theme;
  const [dpr, setDpr] = useState(1.5);
  const [effects, setEffects] = useState(true);
  const lens = useMemo(() => new BlackHoleLensEffect(), []);
  const heat = useMemo(() => new HeatHazeEffect(), []);
  useEffect(
    () => () => {
      lens.dispose();
      heat.dispose();
    },
    [lens, heat],
  );

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      camera={{ fov: 35, near: 0.1, far: 80, position: [0, 8.4, 6] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          console.error("WebGL context lost; rebuilding the scene");
          onContextLost();
        });
        onReady();
      }}
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
      <PageTracker />

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

      <TableBoundary>
        <Suspense fallback={<ProceduralTable />}>
          <Table />
        </Suspense>
      </TableBoundary>
      <BookCarousel bookId={bookId} />
      <ContactShadows position={[0, 0.002, 0]} opacity={0.9} scale={14} blur={2.2} far={1.6} resolution={1024} color="#000000" />
      <DustParticles />
      <LensTracker effect={lens} center={DROP_CAP_WORLD} horizonRadius={0.11} />
      <HeatTracker effect={heat} />
      <WormholeTunnel />
      <LightShaft />

      {effects && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.75} luminanceThreshold={1} luminanceSmoothing={0.25} />
          <primitive object={heat} dispose={null} />
          <primitive object={lens} dispose={null} />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Noise opacity={0.025} />
          <Vignette offset={0.3} darkness={0.8} />
        </EffectComposer>
      )}
      <LoadProgressBridge />
    </Canvas>
  );
}
