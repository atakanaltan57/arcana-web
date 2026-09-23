"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Effect } from "postprocessing";
import * as THREE from "three";
import { ritualMotion } from "@/lib/ritual-store";

const lensFragment = /* glsl */ `
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uStrength;

  void mainUv(inout vec2 uv) {
    if (uStrength <= 0.0) return;
    vec2 aspectFix = vec2(aspect, 1.0);
    vec2 delta = (uv - uCenter) * aspectFix;
    float r = max(length(delta), 1e-4);
    float influence = 1.0 - smoothstep(uRadius * 2.5, uRadius * 9.0, r);
    float bend = uStrength * uRadius * uRadius / r * influence;
    vec2 direction = delta / r;
    uv -= direction * min(bend, r * 0.95) / aspectFix;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 delta = (uv - uCenter) * vec2(aspect, 1.0);
    float r = length(delta);
    float shadow = uStrength > 0.0 ? 1.0 - smoothstep(uRadius * 0.9, uRadius * 1.05, r) : 0.0;
    outputColor = vec4(mix(inputColor.rgb, vec3(0.0), shadow), inputColor.a);
  }
`;

export class BlackHoleLensEffect extends Effect {
  constructor() {
    super("BlackHoleLensEffect", lensFragment, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uCenter", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ["uRadius", new THREE.Uniform(0)],
        ["uStrength", new THREE.Uniform(0)],
      ]),
    });
  }
}

type LensTrackerProps = {
  effect: BlackHoleLensEffect;
  center: [number, number, number];
  horizonRadius: number;
};

export function LensTracker({ effect, center, horizonRadius }: LensTrackerProps) {
  const camera = useThree((state) => state.camera);
  const scratch = useMemo(() => ({ center: new THREE.Vector3(), edge: new THREE.Vector3() }), []);

  useFrame(() => {
    const strength = effect.uniforms.get("uStrength");
    const radius = effect.uniforms.get("uRadius");
    const uvCenter = effect.uniforms.get("uCenter");
    if (!strength || !radius || !uvCenter) return;
    const vortex = ritualMotion.vortex;
    if (vortex <= 0 || ritualMotion.tunnel > 0) {
      strength.value = 0;
      return;
    }
    const worldRadius = horizonRadius * (0.2 + vortex * 5.2);
    scratch.center.set(...center).project(camera);
    scratch.edge.set(center[0] + worldRadius, center[1], center[2]).project(camera);
    const cx = (scratch.center.x + 1) / 2;
    const cy = (scratch.center.y + 1) / 2;
    const ex = (scratch.edge.x + 1) / 2;
    const ey = (scratch.edge.y + 1) / 2;
    const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
    uvCenter.value.set(cx, cy);
    radius.value = Math.hypot((ex - cx) * aspect, ey - cy);
    strength.value = Math.min(1, vortex * 1.4) * 1.1;
  });

  return null;
}
