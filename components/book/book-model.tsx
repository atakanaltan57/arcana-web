"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { BookTheme } from "@/lib/themes";
import { createCoverTextures, createLeatherTextures, createSpineTextures } from "@/lib/textures/cover-textures";
import { BRAND_NAME_UPPER } from "@/lib/brand";
import {
  createAnswerTexture,
  createBlankTextTexture,
  createEpigraphTexture,
  createPageEdgeTexture,
  createPaperNormalTexture,
  createPaperTexture,
  createPrintedPageTexture,
  PRINTED_DROP_CAP,
  PRINTED_LAYOUT,
} from "@/lib/textures/page-textures";
import {
  CHARGE_SECONDS,
  CLOSING_SECONDS,
  OPENING_SECONDS,
  PORTAL_GROW_SECONDS,
  PORTAL_SECONDS,
  PORTAL_TUNNEL_START,
  UNDERPAGE_HOLD,
  ritualMotion,
  ritualStore,
} from "@/lib/ritual-store";
import type { PickedAnswer } from "@/lib/answers/pick-answer";
import { clamp01, easeInOutCubic, easeOutCubic } from "@/lib/easing";
import { playChime, playCrackle, playPortalRumble, playRustle, playTunnel, playWhoosh, stopDrone } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";
import { useLocale } from "@/lib/i18n/locale-store";
import { BURN_DURATION, BURN_IGNITION, EmberParticles } from "./ember-particles";
import { FlameFront } from "./flame-front";
import { enhanceCoverMaterial } from "./cover-material";
import { GemGlint, Starburst } from "./starburst";
import { VortexDisc } from "./wormhole";
import { FLAME_POSITION } from "@/lib/scene-constants";
import { createFlipPageMaterial, createInkPageMaterial, type FlipPageUniforms } from "./page-materials";

export const BOOK_SIZE = {
  width: 3,
  depth: 4.2,
  coverThickness: 0.06,
  pagesThickness: 0.56,
  overhang: 0.09,
} as const;

const FLIP_PAGE_COUNT = 7;
const INK_START = 4;
const INK_DURATION = 3;
const CLOSE_DURATION = 1.7;
const BURN_DONE = BURN_IGNITION + BURN_DURATION * 0.9;
const CLOSE_START = BURN_IGNITION + BURN_DURATION + 0.1 + UNDERPAGE_HOLD;
const REDUCED_CLOSING_SECONDS = 1.3;

const { width, depth, coverThickness, pagesThickness, overhang } = BOOK_SIZE;
const coverWidth = width + overhang;
const coverDepth = depth + overhang * 2;
const halfPages = pagesThickness / 2;
const totalThickness = coverThickness * 2 + pagesThickness;
const axisY = totalThickness / 2;
const spineX = -coverWidth / 2;
const pageInset = 0.025;

export const RIGHT_PAGE = {
  centerX: spineX + pageInset + width / 2,
  y: axisY,
  halfWidth: width / 2,
  halfDepth: depth / 2,
} as const;

export const DROP_CAP_WORLD: [number, number, number] = [
  RIGHT_PAGE.centerX - RIGHT_PAGE.halfWidth + ((PRINTED_DROP_CAP.x + PRINTED_DROP_CAP.size / 2) / PRINTED_LAYOUT.width) * width,
  axisY,
  -RIGHT_PAGE.halfDepth + ((PRINTED_DROP_CAP.y + PRINTED_DROP_CAP.size / 2) / PRINTED_LAYOUT.height) * depth,
];

function flipTiming(index: number) {
  const start = 1.2 + index * 0.22;
  const duration = 0.7 + Math.pow(index / (FLIP_PAGE_COUNT - 1), 2) * 1.05;
  return { start, duration };
}

type BookModelProps = {
  theme: BookTheme;
};

type ThemeAssets = ReturnType<typeof createThemeAssets>;

const themeCache = new Map<string, ThemeAssets>();

export function getThemeAssets(theme: BookTheme) {
  const cached = themeCache.get(theme.id);
  if (cached) return cached;
  const created = createThemeAssets(theme);
  themeCache.set(theme.id, created);
  return created;
}

function createPagesGeometry() {
  const geometry = new THREE.BoxGeometry(width, halfPages, depth, 1, 4, 48);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getX(i) > width / 2 - 1e-4) {
      const z = positions.getZ(i);
      positions.setX(i, positions.getX(i) + 0.007 * Math.sin(z * 9) + 0.004 * Math.sin(z * 23 + 1.3));
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createCoverGeometry() {
  return new RoundedBoxGeometry(coverWidth, coverThickness, coverDepth, 3, 0.022);
}

function createSpineGeometry() {
  return new THREE.CylinderGeometry(axisY, axisY, coverDepth, 32, 1, true, Math.PI, Math.PI);
}

let closedShared: {
  cover: THREE.BufferGeometry;
  pages: THREE.BufferGeometry;
  spine: THREE.BufferGeometry;
  pageFaces: THREE.Material[];
} | null = null;

function getClosedShared() {
  if (!closedShared) {
    const edge = createPageEdgeTexture();
    const edgeMaterial = new THREE.MeshStandardMaterial({ map: edge, bumpMap: edge, bumpScale: 1.2, metalness: 0.08, roughness: 0.62, emissive: "#ffffff", emissiveMap: edge, emissiveIntensity: 0.22 });
    const hidden = new THREE.MeshStandardMaterial({ color: "#d9c9a6", roughness: 0.95 });
    closedShared = {
      cover: createCoverGeometry(),
      pages: createPagesGeometry(),
      spine: createSpineGeometry(),
      pageFaces: [edgeMaterial, hidden, hidden, hidden, edgeMaterial, edgeMaterial],
    };
  }
  return closedShared;
}

const closedPagesCenterX = spineX + pageInset + width / 2;

export function ClosedBook({ theme }: { theme: BookTheme }) {
  const themed = useMemo(() => getThemeAssets(theme), [theme]);
  const shared = useMemo(() => getClosedShared(), []);
  return (
    <group>
      <mesh geometry={shared.cover} material={themed.leatherMaterial} position={[spineX + coverWidth / 2, coverThickness / 2, 0]} />
      <mesh geometry={shared.pages} material={shared.pageFaces} position={[closedPagesCenterX, coverThickness + halfPages / 2, 0]} />
      <group position={[spineX, axisY, 0]}>
        <mesh geometry={shared.pages} material={shared.pageFaces} position={[pageInset + width / 2, halfPages / 2, 0]} />
        <mesh geometry={shared.cover} material={themed.coverFaces} position={[coverWidth / 2, halfPages + coverThickness / 2, 0]} />
        <mesh geometry={shared.spine} material={themed.spineLeather} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
}

function createThemeAssets(theme: BookTheme) {
  const cover = createCoverTextures(theme);
  const leather = createLeatherTextures(theme);
  const spineTextures = createSpineTextures(theme, BRAND_NAME_UPPER);
  const leatherMaterial = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.1,
    clearcoatRoughness: 0.45,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color("#8a4a3a"),
    map: leather.map,
    normalMap: leather.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.62,
    metalness: 0,
  });
  const coverTop = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.1,
    clearcoatRoughness: 0.45,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color("#8a4a3a"),
    map: cover.map,
    normalMap: cover.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: cover.surface,
    metalnessMap: cover.surface,
    roughness: 1,
    metalness: 1,
    emissive: new THREE.Color(theme.goldLight),
    emissiveMap: cover.glow,
    emissiveIntensity: 0,
    envMapIntensity: 0.85,
  });
  const coverUniforms = enhanceCoverMaterial(coverTop, FLAME_POSITION);
  const spineLeather = new THREE.MeshPhysicalMaterial({
    map: spineTextures.map,
    roughnessMap: spineTextures.surface,
    metalnessMap: spineTextures.surface,
    normalMap: leather.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 1,
    metalness: 1,
    clearcoat: 0.1,
    clearcoatRoughness: 0.45,
    envMapIntensity: 0.85,
    side: THREE.DoubleSide,
  });
  return {
    leatherMaterial,
    spineLeather,
    coverTop,
    coverUniforms,
    coverFaces: [leatherMaterial, leatherMaterial, coverTop, leatherMaterial, leatherMaterial, leatherMaterial],
    dispose: () => {
      cover.dispose();
      leather.dispose();
      spineTextures.dispose();
      [leatherMaterial, coverTop, spineLeather].forEach((material) => material.dispose());
    },
  };
}

export function BookModel({ theme }: BookModelProps) {
  const root = useRef<THREE.Group>(null);
  const topHalf = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const flipGroups = useRef<(THREE.Group | null)[]>([]);
  const lastAnswer = useRef<PickedAnswer | null>(null);
  const rustled = useRef<boolean[]>([]);
  const chimed = useRef(false);
  const burning = useRef(false);
  const closeRustled = useRef(false);
  const portalCues = useRef({ started: false, tunnel: false });
  const fireLight = useRef<THREE.PointLight>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    try {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      reducedMotion.current = query.matches;
      const onChange = (event: MediaQueryListEvent) => {
        reducedMotion.current = event.matches;
      };
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    } catch (error) {
      console.error("Reduced motion preference could not be read", error);
    }
  }, []);

  const themed = useMemo(() => getThemeAssets(theme), [theme]);

  const assets = useMemo(() => {
    const paper = createPaperTexture(3);
    const paperLeft = createPaperTexture(9);
    const edge = createPageEdgeTexture();
    const blank = createBlankTextTexture();
    const printed = [createPrintedPageTexture(101), createPrintedPageTexture(202), createPrintedPageTexture(303)];
    const paperNormal = createPaperNormalTexture();

    const edgeMaterial = new THREE.MeshStandardMaterial({ map: edge, bumpMap: edge, bumpScale: 1.2, metalness: 0.08, roughness: 0.62, emissive: "#ffffff", emissiveMap: edge, emissiveIntensity: 0.22 });
    const hiddenPaper = new THREE.MeshStandardMaterial({ color: "#d9c9a6", roughness: 0.95 });
    const underPage = new THREE.MeshStandardMaterial({ map: printed[1], roughness: 0.93 });

    const rightPage = createInkPageMaterial(paper, blank, 0, { normalMap: paperNormal, back: printed[2] });
    const leftPage = createInkPageMaterial(paperLeft, blank, 1, { normalMap: paperNormal, back: printed[0] });
    leftPage.uniforms.uProgress.value = 1;

    const flips = Array.from({ length: FLIP_PAGE_COUNT }, (_, index) =>
      createFlipPageMaterial(printed[index % printed.length], paperNormal),
    );

    const coverGeometry = createCoverGeometry();
    const pagesGeometry = createPagesGeometry();
    const rightPageGeometry = new THREE.PlaneGeometry(width, depth, 40, 48).rotateX(-Math.PI / 2);
    const rightPositions = rightPageGeometry.attributes.position;
    for (let i = 0; i < rightPositions.count; i++) {
      const u = (rightPositions.getX(i) + width / 2) / width;
      const lift = 0.028 * Math.pow(Math.sin(Math.PI * u), 0.8) * Math.min(1, u / 0.12);
      rightPositions.setY(i, rightPositions.getY(i) + lift);
    }
    rightPageGeometry.computeVertexNormals();
    const leftPageGeometry = new THREE.PlaneGeometry(width, depth).rotateX(Math.PI / 2);
    const leftUv = leftPageGeometry.attributes.uv;
    for (let i = 0; i < leftUv.count; i++) {
      leftUv.setXY(i, 1 - leftUv.getX(i), 1 - leftUv.getY(i));
    }
    const flipGeometry = new THREE.PlaneGeometry(width, depth, 40, 1)
      .rotateX(-Math.PI / 2)
      .translate(pageInset + width / 2, 0, 0);
    const spineGeometry = createSpineGeometry();
    return {
      blankText: blank,
      pageFaces: [edgeMaterial, hiddenPaper, underPage, hiddenPaper, edgeMaterial, edgeMaterial],
      rightPage,
      leftPage,
      flips,
      geometries: { coverGeometry, pagesGeometry, rightPageGeometry, leftPageGeometry, flipGeometry, spineGeometry },
      dispose: () => {
        [paper, paperLeft, paperNormal, edge, blank, ...printed].forEach((texture) => texture.dispose());
        [edgeMaterial, hiddenPaper, underPage, rightPage.material, leftPage.material].forEach(
          (material) => material.dispose(),
        );
        flips.forEach((flip) => flip.material.dispose());
        [coverGeometry, pagesGeometry, rightPageGeometry, leftPageGeometry, flipGeometry, spineGeometry].forEach(
          (geometry) => geometry.dispose(),
        );
      },
    };
  }, []);

  useEffect(() => assets.dispose, [assets]);

  const locale = useLocale();

  useEffect(() => {
    let cancelled = false;
    createEpigraphTexture()
      .then((texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        const previous = assets.leftPage.uniforms.uText.value;
        assets.leftPage.uniforms.uText.value = texture;
        if (previous && previous !== texture && previous !== assets.blankText) previous.dispose();
      })
      .catch((error: unknown) => console.error("Epigraph texture failed", error));
    return () => {
      cancelled = true;
    };
  }, [assets, locale]);

  const loadAnswer = (answer: PickedAnswer) => {
    createAnswerTexture(answer.text, answer.page, answer.bookTitle, answer.question, answer.golden)
      .then((texture) => {
        if (lastAnswer.current !== answer) {
          texture.dispose();
          return;
        }
        const previous = assets.rightPage.uniforms.uText.value;
        assets.rightPage.uniforms.uText.value = texture;
        if (previous instanceof THREE.CanvasTexture) previous.dispose();
      })
      .catch((error: unknown) => console.error("Answer texture failed", error));
  };

  const setFlip = (uniforms: FlipPageUniforms, group: THREE.Group | null, progress: number) => {
    if (!group) return;
    group.visible = progress > 0 && progress < 1.001;
    uniforms.uAngle.value = Math.PI * easeOutCubic(progress) * 0.995;
    uniforms.uBend.value = (-1.7 * Math.sin(Math.PI * progress)) / width;
  };

  useFrame((state, delta) => {
    const { phase, answer } = ritualStore.getSnapshot();
    const motion = ritualMotion;
    motion.phaseTime += delta * motion.tempo;
    const t = motion.phaseTime;

    let coverAngle = 0;
    let glow = 0;
    let open = 0;
    let tremble = 0;
    let fire = 0;
    assets.rightPage.uniforms.uTime.value = state.clock.elapsedTime;
    const cover = themed.coverUniforms;
    cover.uTime.value = state.clock.elapsedTime;
    cover.uGlint.value.set(motion.glint[0], motion.glint[1], motion.glint[2]);
    let ignite = 1.2;
    let sparkle = 5 + motion.hover * 3;
    motion.flash = Math.max(0, motion.flash - delta * 2.2);

    if (phase === "idle") {
      motion.charge = Math.max(0, motion.charge - delta * 2);
      motion.attract = motion.charge;
      motion.burst = Math.max(0, motion.burst - delta);
      glow = motion.hover * 0.12 + Math.sin(state.clock.elapsedTime * 1.3) * 0.02 + 0.02;
      assets.rightPage.uniforms.uProgress.value = 0;
      assets.rightPage.uniforms.uBurn.value = 0;
      motion.burnClock = -1;
      flipGroups.current.forEach((group) => {
        if (group) group.visible = false;
      });
    }

    if (phase === "charging") {
      motion.charge = Math.min(1, motion.charge + (delta * motion.tempo) / CHARGE_SECONDS);
      motion.attract = motion.charge;
      glow = 0.35 + motion.charge * 0.85 + Math.sin(state.clock.elapsedTime * 14) * 0.06 * motion.charge;
      ignite = motion.charge * 1.15;
      sparkle = 5 + motion.charge * 14;
      tremble = motion.charge * motion.charge;
      if (motion.charge >= 1) {
        stopDrone();
        playWhoosh();
        vibrate(35);
        ritualStore.open();
        motion.flash = 1;
        rustled.current = [];
        chimed.current = false;
      }
    }

    if (phase === "opening") {
      if (answer && lastAnswer.current !== answer) {
        lastAnswer.current = answer;
        assets.rightPage.uniforms.uProgress.value = 0;
        loadAnswer(answer);
      }
      coverAngle = Math.PI * easeInOutCubic((t - 0.05) / 2);
      open = easeInOutCubic((t - 0.3) / 3.2);
      glow = Math.max(0, 1.2 * (1 - t / 0.7));
      motion.attract = Math.max(0, 1 - t / 0.35);
      motion.burst = t < 0.05 ? 1 : Math.max(0, motion.burst - delta * 0.7);

      assets.flips.forEach((flip, index) => {
        const { start, duration } = flipTiming(index);
        const progress = clamp01((t - start) / duration);
        if (progress > 0 && !rustled.current[index]) {
          rustled.current[index] = true;
          playRustle(index === FLIP_PAGE_COUNT - 1 ? 1.3 : 0.8);
        }
        setFlip(flip.uniforms, flipGroups.current[index], progress);
      });

      const ink = clamp01((t - INK_START) / INK_DURATION);
      assets.rightPage.uniforms.uProgress.value = ink;
      if (t >= INK_START && !chimed.current) {
        chimed.current = true;
        playChime();
        vibrate([12, 60, 12]);
      }
      if (t >= OPENING_SECONDS) {
        ritualStore.reveal();
      }
    }

    if (phase === "revealed") {
      coverAngle = Math.PI;
      open = 1;
      motion.attract = 0;
      motion.burst = Math.max(0, motion.burst - delta * 0.7);
      assets.rightPage.uniforms.uProgress.value = 1;
    }

    if (phase === "closing" && reducedMotion.current) {
      coverAngle = Math.PI * (1 - easeInOutCubic(t / 1.1));
      open = 1 - easeInOutCubic(t / 1.2);
      assets.rightPage.uniforms.uProgress.value = Math.max(0, 1 - t / 0.5);
      flipGroups.current.forEach((group) => {
        if (group) group.visible = false;
      });
      if (t >= REDUCED_CLOSING_SECONDS) {
        lastAnswer.current = null;
        ritualStore.settle();
      }
    } else if (phase === "closing") {
      const uniforms = assets.rightPage.uniforms;
      motion.portalReady = t >= BURN_DONE && t < CLOSE_START - 0.2;
      if (!burning.current) {
        burning.current = true;
        closeRustled.current = false;
        motion.burnOriginU = Math.random() < 0.5 ? 0.08 + Math.random() * 0.08 : 0.84 + Math.random() * 0.08;
        motion.burnOriginV = 0.05 + Math.random() * 0.12;
        motion.burnId += 1;
        uniforms.uBurnOrigin.value.set(motion.burnOriginU, motion.burnOriginV);
        playCrackle((BURN_DURATION + 0.3) / motion.tempo);
        vibrate([8, 120, 8, 90, 10]);
      }
      motion.burnClock = t;
      const burn = clamp01((t - BURN_IGNITION) / BURN_DURATION);
      uniforms.uBurn.value = t > 0.02 ? Math.max(0.004, burn) : 0;
      fire = Math.pow(Math.sin(Math.PI * Math.min(1, burn * 1.05)), 0.6) + (t < BURN_IGNITION + 0.3 ? 0.4 : 0);

      const k = easeInOutCubic((t - CLOSE_START) / CLOSE_DURATION);
      coverAngle = Math.PI * (1 - k);
      open = 1 - easeInOutCubic((t - CLOSE_START + 0.1) / (CLOSE_DURATION + 0.1));
      if (t >= CLOSE_START) {
        flipGroups.current.forEach((group) => {
          if (group) group.visible = false;
        });
        if (!closeRustled.current) {
          closeRustled.current = true;
          playRustle(0.6);
        }
      }
      if (t >= CLOSING_SECONDS) {
        burning.current = false;
        uniforms.uBurn.value = 0;
        uniforms.uProgress.value = 0;
        motion.burnClock = -1;
        lastAnswer.current = null;
        ritualStore.settle();
      }
    }

    if (phase === "portal" || phase === "departed") {
      coverAngle = Math.PI;
      open = 1;
      assets.rightPage.uniforms.uBurn.value = 1;
      motion.burnClock = -1;
      burning.current = false;
      const cues = portalCues.current;
      if (phase === "portal" && !cues.started) {
        cues.started = true;
        cues.tunnel = false;
        motion.attractCenter = [DROP_CAP_WORLD[0], DROP_CAP_WORLD[1] + 0.15, DROP_CAP_WORLD[2]];
        playPortalRumble(PORTAL_SECONDS);
        vibrate([30, 60, 50, 60, 80]);
      }
      if (phase === "portal") {
        if (reducedMotion.current) {
          motion.tunnel = 1;
          if (t >= 0.4) ritualStore.depart();
        } else {
          motion.vortex = Math.pow(clamp01(t / PORTAL_GROW_SECONDS), 2.4);
          motion.dive = easeInOutCubic((t - PORTAL_GROW_SECONDS + 0.4) / 1.5);
          motion.tunnel = clamp01((t - PORTAL_TUNNEL_START) / (PORTAL_SECONDS - PORTAL_TUNNEL_START - 0.1));
          motion.attract = Math.min(1, t / 1.6);
          fire = 0.6 + motion.vortex * 0.8;
          if (t >= PORTAL_TUNNEL_START - 0.05 && !cues.tunnel) {
            cues.tunnel = true;
            playTunnel(PORTAL_SECONDS - PORTAL_TUNNEL_START);
          }
          if (t >= PORTAL_SECONDS) ritualStore.depart();
        }
      }
    } else {
      portalCues.current.started = false;
      motion.vortex = 0;
      motion.dive = 0;
      motion.tunnel = 0;
      if (phase !== "charging") motion.attractCenter = [0, 0.7, 0];
    }
    if (phase !== "closing") motion.portalReady = false;

    motion.open = open;
    if (fireLight.current) {
      const time = state.clock.elapsedTime;
      const flicker = 0.72 + 0.16 * Math.sin(time * 11.3 + Math.sin(time * 2.7) * 2) + 0.12 * Math.sin(time * 23.9 + Math.sin(time * 5.1));
      fireLight.current.intensity = fire * 6 * flicker;
    }
    cover.uIgnite.value = ignite;
    cover.uGem.value =
      0.32 + 0.22 * Math.pow(0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 1.1), 3) + motion.charge * 1.6 + motion.hover * 0.15;
    cover.uSparkle.value = THREE.MathUtils.damp(cover.uSparkle.value, sparkle, 6, delta);
    themed.coverTop.emissiveIntensity = THREE.MathUtils.damp(themed.coverTop.emissiveIntensity, glow, 10, delta);

    if (topHalf.current) topHalf.current.rotation.z = coverAngle;
    if (spine.current) spine.current.rotation.z = coverAngle / 2;

    const group = root.current;
    if (group) {
      const jitter = tremble * 0.006;
      group.rotation.x = (Math.random() - 0.5) * jitter;
      group.rotation.z = (Math.random() - 0.5) * jitter;
      group.position.y = tremble * 0.02 * Math.abs(Math.sin(state.clock.elapsedTime * 30));
    }
  });

  const onPointerOver = () => {
    ritualMotion.hover = 1;
  };
  const onPointerOut = () => {
    ritualMotion.hover = 0;
  };

  const pagesCenterX = spineX + pageInset + width / 2;

  return (
    <group ref={root} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <mesh
        geometry={assets.geometries.coverGeometry}
        material={themed.leatherMaterial}
        position={[spineX + coverWidth / 2, coverThickness / 2, 0]}
      />
      <mesh
        geometry={assets.geometries.pagesGeometry}
        material={assets.pageFaces}
        position={[pagesCenterX, coverThickness + halfPages / 2, 0]}
      />
      <mesh
        geometry={assets.geometries.rightPageGeometry}
        material={assets.rightPage.material}
        position={[pagesCenterX, axisY + 0.0015, 0]}
      />

      <group ref={topHalf} position={[spineX, axisY, 0]}>
        <mesh
          geometry={assets.geometries.pagesGeometry}
          material={assets.pageFaces}
          position={[pageInset + width / 2, halfPages / 2, 0]}
        />
        <mesh
          geometry={assets.geometries.leftPageGeometry}
          material={assets.leftPage.material}
          position={[pageInset + width / 2, -0.0015, 0]}
        />
        <mesh
          geometry={assets.geometries.coverGeometry}
          material={themed.coverFaces}
          position={[coverWidth / 2, halfPages + coverThickness / 2, 0]}
        />
      </group>

      <group ref={spine} position={[spineX, axisY, 0]}>
        <mesh
          geometry={assets.geometries.spineGeometry}
          material={themed.spineLeather}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>

      <Starburst position={[0, totalThickness + 0.25, 0]} />
      <GemGlint position={[0, totalThickness + 0.03, 0.02]} />
      <pointLight
        ref={fireLight}
        position={[pagesCenterX, axisY + 0.7, 0.4]}
        color="#ff6a1a"
        intensity={0}
        decay={2}
      />
      <VortexDisc position={[DROP_CAP_WORLD[0], DROP_CAP_WORLD[1] + 0.01, DROP_CAP_WORLD[2]]} />
      <mesh
        position={[DROP_CAP_WORLD[0], DROP_CAP_WORLD[1] + 0.004, DROP_CAP_WORLD[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => {
          if (!ritualMotion.portalReady) return;
          event.stopPropagation();
          document.body.style.cursor = "";
          ritualStore.enterPortal();
        }}
        onPointerOver={() => {
          if (ritualMotion.portalReady) document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[0.4, 0.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <EmberParticles
        pageMinX={pagesCenterX - width / 2}
        pageMaxX={pagesCenterX + width / 2}
        pageNearZ={depth / 2}
        pageFarZ={-depth / 2}
        pageY={axisY}
      />
      <FlameFront
        pageMinX={pagesCenterX - width / 2}
        pageMaxX={pagesCenterX + width / 2}
        pageNearZ={depth / 2}
        pageFarZ={-depth / 2}
        pageY={axisY}
      />

      {assets.flips.map((flip, index) => (
        <group
          key={index}
          ref={(node) => {
            flipGroups.current[index] = node;
          }}
          position={[spineX, axisY + 0.004 + index * 0.0015, 0]}
          visible={false}
        >
          <mesh geometry={assets.geometries.flipGeometry} material={flip.material} />
        </group>
      ))}
    </group>
  );
}
