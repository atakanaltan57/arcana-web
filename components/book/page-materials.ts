import * as THREE from "three";
import { BURN_ASPECT, BURN_REACH } from "@/lib/noise";

export type FlipPageUniforms = {
  uAngle: { value: number };
  uBend: { value: number };
};

export function createFlipPageMaterial(map: THREE.Texture, normalMap?: THREE.Texture) {
  const uniforms: FlipPageUniforms = {
    uAngle: { value: 0 },
    uBend: { value: 0 },
  };
  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap: normalMap ?? null,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform float uAngle;\nuniform float uBend;\n${shader.vertexShader}`
      .replace(
        "#include <beginnormal_vertex>",
        `float pageS = position.x;
        float pagePhi = uAngle + uBend * pageS;
        vec3 objectNormal = vec3(-sin(pagePhi), cos(pagePhi), 0.0);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed;
        if (abs(uBend) < 0.0001) {
          transformed = vec3(cos(uAngle) * pageS, sin(uAngle) * pageS, position.z);
        } else {
          transformed = vec3(
            (sin(pagePhi) - sin(uAngle)) / uBend,
            (cos(uAngle) - cos(pagePhi)) / uBend,
            position.z
          );
        }
        #ifdef USE_ALPHAHASH
          vPosition = vec3(position);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `vec2 sheetUv = gl_FrontFacing ? vMapUv : vec2(1.0 - vMapUv.x, vMapUv.y);
      vec4 sampledDiffuseColor = texture2D(map, sheetUv);
      diffuseColor *= sampledDiffuseColor;`,
    );
  };
  material.customProgramCacheKey = () => "flip-page";
  return { material, uniforms };
}

export type InkPageUniforms = {
  uText: { value: THREE.Texture };
  uProgress: { value: number };
  uGutterSide: { value: number };
  uBurn: { value: number };
  uBurnOrigin: { value: THREE.Vector2 };
  uTime: { value: number };
  uBack: { value: THREE.Texture };
  uHasBack: { value: number };
};

type InkPageOptions = {
  normalMap?: THREE.Texture;
  back?: THREE.Texture;
};

const noiseChunk = /* glsl */ `
  float inkHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float inkNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(inkHash(i), inkHash(i + vec2(1.0, 0.0)), u.x),
      mix(inkHash(i + vec2(0.0, 1.0)), inkHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float inkFbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amp * inkNoise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return value;
  }
`;

export function createInkPageMaterial(
  paper: THREE.Texture,
  text: THREE.Texture,
  gutterSide: 0 | 1,
  options: InkPageOptions = {},
) {
  const uniforms: InkPageUniforms = {
    uText: { value: text },
    uProgress: { value: 0 },
    uGutterSide: { value: gutterSide },
    uBurn: { value: 0 },
    uBurnOrigin: { value: new THREE.Vector2(0.9, 0.08) },
    uTime: { value: 0 },
    uBack: { value: options.back ?? text },
    uHasBack: { value: options.back ? 1 : 0 },
  };
  const material = new THREE.MeshStandardMaterial({
    map: paper,
    normalMap: options.normalMap ?? null,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.93,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `uniform sampler2D uText;\nuniform float uProgress;\nuniform float uGutterSide;\nuniform float uBurn;\nuniform vec2 uBurnOrigin;\nuniform float uTime;\nuniform sampler2D uBack;\nuniform float uHasBack;\n${noiseChunk}\n${shader.fragmentShader}`.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      vec2 pageUv = vMapUv;
      float gutterDistance = uGutterSide < 0.5 ? pageUv.x : 1.0 - pageUv.x;
      diffuseColor.rgb *= mix(0.42, 1.0, smoothstep(0.0, 0.2, gutterDistance));
      diffuseColor.rgb *= mix(0.9, 1.0, smoothstep(0.0, 0.05, min(pageUv.y, 1.0 - pageUv.y)));

      vec4 glyph = texture2D(uText, pageUv);
      vec4 halo = texture2D(uText, pageUv, 3.5);
      float n = inkFbm(pageUv * vec2(9.0, 13.0));
      float key = (1.0 - pageUv.y) * 0.7 + n * 0.3;
      float front = uProgress * 1.3 - 0.15;
      float shown = smoothstep(key - 0.03, key + 0.03, front);
      float wet = (1.0 - smoothstep(0.0, 0.09, abs(front - key))) * (1.0 - step(0.999, uProgress));
      float grain = 0.85 + 0.15 * inkNoise(pageUv * 900.0);
      vec3 backSample = texture2D(uBack, vec2(1.0 - pageUv.x, pageUv.y)).rgb;
      float backInk = clamp(1.0 - dot(backSample, vec3(0.333)) * 1.25, 0.0, 1.0);
      diffuseColor.rgb *= 1.0 - backInk * 0.08 * uHasBack;

      vec3 inkColor = vec3(0.09, 0.055, 0.04);
      vec3 rubricColor = vec3(0.46, 0.08, 0.06);
      float inkAmount = clamp((glyph.r * shown + halo.r * wet * 0.5) * grain, 0.0, 0.95);
      float rubricAmount = clamp((glyph.g * shown + halo.g * wet * 0.4) * grain, 0.0, 0.9);
      diffuseColor.rgb = mix(diffuseColor.rgb, inkColor, inkAmount);
      diffuseColor.rgb = mix(diffuseColor.rgb, rubricColor, rubricAmount);
      float goldAmount = clamp(glyph.b * shown * (0.8 + 0.2 * grain), 0.0, 0.95);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.46, 0.17), goldAmount);

      float burnGlow = 0.0;
      if (uBurn > 0.0) {
        vec2 burnDelta = vec2(pageUv.x - uBurnOrigin.x, (pageUv.y - uBurnOrigin.y) * ${BURN_ASPECT.toFixed(2)});
        float burnKey = length(burnDelta) * 0.75 + inkFbm(pageUv * vec2(6.0, 8.4) + 3.1) * 0.45;
        float burnFront = uBurn * ${BURN_REACH.toFixed(2)};
        float burnDist = burnKey - burnFront;
        float flake = inkNoise(pageUv * 150.0);
        float fine = inkNoise(pageUv * 420.0 + uTime * 0.5);

        if (burnDist < -0.07 - flake * 0.09) discard;

        float scorch = 1.0 - smoothstep(0.0, 0.16, burnDist);
        vec3 scorched = mix(vec3(0.42, 0.24, 0.1), vec3(0.08, 0.04, 0.02), 1.0 - smoothstep(0.0, 0.08, burnDist));
        diffuseColor.rgb = mix(diffuseColor.rgb, scorched, scorch * 0.9);

        float ash = 1.0 - smoothstep(-0.04, -0.004, burnDist);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.095, 0.09) * (0.55 + flake * 0.9), ash);

        float flicker = 0.75 + 0.25 * sin(uTime * 23.0 + pageUv.x * 40.0) * sin(uTime * 17.0 + pageUv.y * 31.0);
        float rim = (1.0 - smoothstep(0.0, 0.025, burnDist)) * smoothstep(-0.05, -0.008, burnDist);
        float embers = step(0.74, fine) * smoothstep(-0.1, -0.045, burnDist) * (1.0 - smoothstep(-0.025, -0.004, burnDist));
        burnGlow = (rim * (0.8 + fine * 0.6) + embers * 0.6) * flicker;
      }`,
    )
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(2.6, 0.72, 0.12) * burnGlow;`,
    );
  };
  material.customProgramCacheKey = () => "ink-page";
  return { material, uniforms };
}
