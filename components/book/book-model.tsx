"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { BookTheme } from "@/lib/themes";
import { createCoverTextures, createLeatherTextures } from "@/lib/textures/cover-textures";
import {
  createAnswerTexture,
  createBlankTextTexture,
  createEpigraphTexture,
  createPageEdgeTexture,
  createPaperTexture,
  createPrintedPageTexture,
} from "@/lib/textures/page-textures";
import { CHARGE_SECONDS, CLOSING_SECONDS, OPENING_SECONDS, ritualMotion, ritualStore } from "@/lib/ritual-store";
import type { PickedAnswer } from "@/lib/answers/pick-answer";
import { clamp01, easeInOutCubic, easeOutCubic } from "@/lib/easing";
import { playChime, playRustle, playWhoosh, stopDrone } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";
import { createFlipPageMaterial, createInkPageMaterial, type FlipPageUniforms } from "./page-materials";

export const BOOK_SIZE = {
  width: 3,
  depth: 4.2,
  coverThickness: 0.06,
  pagesThickness: 0.56,
  overhang: 0.09,
} as const;

const FLIP_PAGE_COUNT = 7;
const INK_START = 2.55;
const INK_DURATION = 2.3;

const { width, depth, coverThickness, pagesThickness, overhang } = BOOK_SIZE;
const coverWidth = width + overhang;
const coverDepth = depth + overhang * 2;
const halfPages = pagesThickness / 2;
const totalThickness = coverThickness * 2 + pagesThickness;
const axisY = totalThickness / 2;
const spineX = -coverWidth / 2;
const pageInset = 0.025;

function flipTiming(index: number) {
  const start = 0.8 + index * 0.16;
  const duration = 0.48 + Math.pow(index / (FLIP_PAGE_COUNT - 1), 2) * 0.75;
  return { start, duration };
}

type BookModelProps = {
  theme: BookTheme;
};

export function BookModel({ theme }: BookModelProps) {
  const root = useRef<THREE.Group>(null);
  const topHalf = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const flipGroups = useRef<(THREE.Group | null)[]>([]);
  const lastAnswer = useRef<PickedAnswer | null>(null);
  const rustled = useRef<boolean[]>([]);
  const chimed = useRef(false);

  const assets = useMemo(() => {
    const cover = createCoverTextures(theme);
    const leather = createLeatherTextures(theme);
    const paper = createPaperTexture(3);
    const paperLeft = createPaperTexture(9);
    const edge = createPageEdgeTexture();
    const blank = createBlankTextTexture();
    const printed = [createPrintedPageTexture(101), createPrintedPageTexture(202), createPrintedPageTexture(303)];

    const leatherMaterial = new THREE.MeshStandardMaterial({
      map: leather.map,
      normalMap: leather.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.62,
      metalness: 0,
    });
    const coverTop = new THREE.MeshStandardMaterial({
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
    const edgeMaterial = new THREE.MeshStandardMaterial({ map: edge, roughness: 0.9 });
    const hiddenPaper = new THREE.MeshStandardMaterial({ color: "#d9c9a6", roughness: 0.95 });

    const rightPage = createInkPageMaterial(paper, blank, 0);
    const leftPage = createInkPageMaterial(paperLeft, blank, 1);
    leftPage.uniforms.uProgress.value = 1;

    const flips = Array.from({ length: FLIP_PAGE_COUNT }, (_, index) =>
      createFlipPageMaterial(printed[index % printed.length]),
    );

    const coverGeometry = new RoundedBoxGeometry(coverWidth, coverThickness, coverDepth, 3, 0.022);
    const pagesGeometry = new THREE.BoxGeometry(width, halfPages, depth);
    const rightPageGeometry = new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
    const leftPageGeometry = new THREE.PlaneGeometry(width, depth).rotateX(Math.PI / 2);
    const leftUv = leftPageGeometry.attributes.uv;
    for (let i = 0; i < leftUv.count; i++) {
      leftUv.setXY(i, 1 - leftUv.getX(i), 1 - leftUv.getY(i));
    }
    const flipGeometry = new THREE.PlaneGeometry(width, depth, 40, 1)
      .rotateX(-Math.PI / 2)
      .translate(pageInset + width / 2, 0, 0);
    const spineGeometry = new THREE.CylinderGeometry(axisY, axisY, coverDepth, 32, 1, true, Math.PI, Math.PI);
    const spineLeather = leatherMaterial.clone();
    spineLeather.side = THREE.DoubleSide;

    return {
      leatherMaterial,
      spineLeather,
      coverFaces: [leatherMaterial, leatherMaterial, coverTop, leatherMaterial, leatherMaterial, leatherMaterial],
      pageFaces: [edgeMaterial, hiddenPaper, hiddenPaper, hiddenPaper, edgeMaterial, edgeMaterial],
      coverTop,
      rightPage,
      leftPage,
      flips,
      geometries: { coverGeometry, pagesGeometry, rightPageGeometry, leftPageGeometry, flipGeometry, spineGeometry },
      dispose: () => {
        cover.dispose();
        leather.dispose();
        [paper, paperLeft, edge, blank, ...printed].forEach((texture) => texture.dispose());
        [leatherMaterial, spineLeather, coverTop, edgeMaterial, hiddenPaper, rightPage.material, leftPage.material].forEach(
          (material) => material.dispose(),
        );
        flips.forEach((flip) => flip.material.dispose());
        [coverGeometry, pagesGeometry, rightPageGeometry, leftPageGeometry, flipGeometry, spineGeometry].forEach(
          (geometry) => geometry.dispose(),
        );
      },
    };
  }, [theme]);

  useEffect(() => assets.dispose, [assets]);

  useEffect(() => {
    let cancelled = false;
    createEpigraphTexture()
      .then((texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        assets.leftPage.uniforms.uText.value = texture;
      })
      .catch((error: unknown) => console.error("Epigraph texture failed", error));
    return () => {
      cancelled = true;
    };
  }, [assets]);

  const loadAnswer = (answer: PickedAnswer) => {
    createAnswerTexture(answer.text, answer.page)
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
    motion.phaseTime += delta;
    const t = motion.phaseTime;

    let coverAngle = 0;
    let glow = 0;
    let open = 0;
    let tremble = 0;

    if (phase === "idle") {
      motion.charge = Math.max(0, motion.charge - delta * 2);
      motion.attract = motion.charge;
      motion.burst = Math.max(0, motion.burst - delta);
      glow = motion.hover * 0.12 + Math.sin(state.clock.elapsedTime * 1.3) * 0.02 + 0.02;
      assets.rightPage.uniforms.uProgress.value = 0;
      flipGroups.current.forEach((group) => {
        if (group) group.visible = false;
      });
    }

    if (phase === "charging") {
      motion.charge = Math.min(1, motion.charge + delta / CHARGE_SECONDS);
      motion.attract = motion.charge;
      glow = Math.pow(motion.charge, 1.6) * 1.9 + Math.sin(state.clock.elapsedTime * 14) * 0.08 * motion.charge;
      tremble = motion.charge * motion.charge;
      if (motion.charge >= 1) {
        stopDrone();
        playWhoosh();
        vibrate(35);
        ritualStore.open();
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
      coverAngle = Math.PI * easeInOutCubic((t - 0.05) / 1.35);
      open = easeInOutCubic((t - 0.2) / 2.3);
      glow = Math.max(0, 1.9 * (1 - t / 0.7));
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

    if (phase === "closing") {
      const k = easeInOutCubic(t / 1.1);
      coverAngle = Math.PI * (1 - k);
      open = 1 - easeInOutCubic(t / 1.2);
      assets.rightPage.uniforms.uProgress.value = Math.max(0, 1 - t / 0.5);
      flipGroups.current.forEach((group) => {
        if (group) group.visible = false;
      });
      if (t > 0.1 && t - delta <= 0.1) playRustle(0.6);
      if (t >= CLOSING_SECONDS) {
        lastAnswer.current = null;
        ritualStore.settle();
      }
    }

    motion.open = open;
    assets.coverTop.emissiveIntensity = THREE.MathUtils.damp(assets.coverTop.emissiveIntensity, glow, 10, delta);

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
        material={assets.leatherMaterial}
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
          material={assets.coverFaces}
          position={[coverWidth / 2, halfPages + coverThickness / 2, 0]}
        />
      </group>

      <group ref={spine} position={[spineX, axisY, 0]}>
        <mesh
          geometry={assets.geometries.spineGeometry}
          material={assets.spineLeather}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>

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
