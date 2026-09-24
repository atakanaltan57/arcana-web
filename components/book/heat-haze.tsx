"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Effect } from "postprocessing";
import * as THREE from "three";
import { heatSources } from "./flame-front";

const HEAT_SLOTS = heatSources.strengths.length;

const hazeFragment = /* glsl */ `
  uniform vec3 uPoints[${HEAT_SLOTS}];
  uniform int uCount;
  uniform float uTime;
  uniform float uRadius;

  void mainUv(inout vec2 uv) {
    if (uCount == 0) return;
    float mask = 0.0;
    for (int i = 0; i < ${HEAT_SLOTS}; i++) {
      if (i >= uCount) break;
      vec3 source = uPoints[i];
      vec2 delta = (uv - source.xy) * vec2(aspect, 1.0);
      float above = smoothstep(-0.02, 0.04, delta.y) * exp(-max(delta.y, 0.0) / (uRadius * 3.5));
      float spread = exp(-(delta.x * delta.x) / (uRadius * uRadius * (1.0 + max(delta.y, 0.0) * 18.0)));
      mask += above * spread * source.z;
    }
    mask = min(mask, 1.0);
    if (mask <= 0.001) return;
    vec2 ripple = vec2(
      sin(uv.y * 140.0 - uTime * 11.0 + sin(uv.x * 60.0 + uTime * 3.0)),
      cos(uv.x * 110.0 + uTime * 8.0 + sin(uv.y * 50.0 - uTime * 2.0))
    );
    uv += ripple * 0.0035 * mask;
  }
`;

export class HeatHazeEffect extends Effect {
  constructor() {
    super("HeatHazeEffect", hazeFragment, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uPoints", new THREE.Uniform(Array.from({ length: HEAT_SLOTS }, () => new THREE.Vector3()))],
        ["uCount", new THREE.Uniform(0)],
        ["uTime", new THREE.Uniform(0)],
        ["uRadius", new THREE.Uniform(0.05)],
      ]),
    });
  }
}

export function HeatTracker({ effect }: { effect: HeatHazeEffect }) {
  const camera = useThree((state) => state.camera);
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const points = effect.uniforms.get("uPoints");
    const count = effect.uniforms.get("uCount");
    const time = effect.uniforms.get("uTime");
    if (!points || !count || !time) return;
    time.value = state.clock.elapsedTime;
    const slots = points.value as THREE.Vector3[];
    let active = 0;
    for (let i = 0; i < heatSources.count; i++) {
      projected.copy(heatSources.points[i]).project(camera);
      if (projected.z > 1) continue;
      slots[active].set((projected.x + 1) / 2, (projected.y + 1) / 2, heatSources.strengths[i]);
      active += 1;
    }
    count.value = active;
  });

  return null;
}
