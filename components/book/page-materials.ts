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
  uImage: { value: THREE.Texture };
  uImageRect: { value: THREE.Vector4 };
  uHasImage: { value: number };
};

type InkPageOptions = {
  normalMap?: THREE.Texture;
  back?: THREE.Texture;
};

export const burnChunk = /* glsl */ `
  float inkBurnDistance(vec2 uv) {
    vec2 delta = vec2(uv.x - uBurnOrigin.x, (uv.y - uBurnOrigin.y) * ${BURN_ASPECT.toFixed(2)});
    float key = length(delta) * 0.75 + inkFbm(uv * vec2(6.0, 8.4) + 3.1) * 0.45;
    return key - uBurn * ${BURN_REACH.toFixed(2)};
  }
`;

export const noiseChunk = /* glsl */ `
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
    uImage: { value: text },
    uImageRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uHasImage: { value: 0 },
  };
  const material = new THREE.MeshStandardMaterial({
    map: paper,
    normalMap: options.normalMap ?? null,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.93,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform float uBurn;\nuniform vec2 uBurnOrigin;\n${noiseChunk}\n${burnChunk}\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      if (uBurn > 0.0) {
        float curlDist = inkBurnDistance(uv);
        float curl = smoothstep(0.1, -0.04, curlDist) * (0.045 + 0.03 * inkNoise(uv * 9.0));
        transformed.y += curl;
      }`,
    );
    shader.fragmentShader = `uniform sampler2D uText;\nuniform float uProgress;\nuniform float uGutterSide;\nuniform float uBurn;\nuniform vec2 uBurnOrigin;\nuniform float uTime;\nuniform sampler2D uBack;\nuniform float uHasBack;\nuniform sampler2D uImage;\nuniform vec4 uImageRect;\nuniform float uHasImage;\n${noiseChunk}\n${burnChunk}\n${shader.fragmentShader}`.replace(
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
      float grain = 0.93 + 0.07 * inkNoise(pageUv * 900.0);
      vec3 backSample = texture2D(uBack, vec2(1.0 - pageUv.x, pageUv.y)).rgb;
      float backInk = clamp(1.0 - dot(backSample, vec3(0.333)) * 1.25, 0.0, 1.0);
      diffuseColor.rgb *= 1.0 - backInk * 0.08 * uHasBack;

      vec3 inkColor = vec3(0.055, 0.032, 0.022);
      vec3 rubricColor = vec3(0.36, 0.05, 0.04);
      float inkAmount = clamp((glyph.r * shown + halo.r * wet * 0.5) * grain, 0.0, 1.0);
      float rubricAmount = clamp((glyph.g * shown + halo.g * wet * 0.4) * grain, 0.0, 0.9);
      diffuseColor.rgb = mix(diffuseColor.rgb, inkColor, inkAmount);
      diffuseColor.rgb = mix(diffuseColor.rgb, rubricColor, rubricAmount);
      float goldAmount = clamp(glyph.b * shown * (0.8 + 0.2 * grain), 0.0, 0.95);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.46, 0.17), goldAmount);

      if (uHasImage > 0.5) {
        vec2 artUv = (pageUv - uImageRect.xy) / (uImageRect.zw - uImageRect.xy);
        if (artUv.x >= 0.0 && artUv.x <= 1.0 && artUv.y >= 0.0 && artUv.y <= 1.0) {
          vec3 art = texture2D(uImage, artUv).rgb;
          vec3 printed = art * diffuseColor.rgb * 1.12 * vec3(1.0, 0.97, 0.9);
          diffuseColor.rgb = mix(diffuseColor.rgb, printed, shown * (0.9 + 0.1 * grain));
        }
      }

      float burnGlow = 0.0;
      vec3 burnColor = vec3(0.0);
      if (uBurn > 0.0) {
        float burnDist = inkBurnDistance(pageUv);
        float edgeWarp = inkFbm(pageUv * 28.0 + 7.3);
        float crawl = inkFbm(pageUv * 55.0 + vec2(uTime * 0.35, -uTime * 0.2));
        float mottle = inkFbm(pageUv * 20.0 + 1.7);

        if (burnDist < -0.04 - edgeWarp * 0.025) discard;

        float heat = 1.0 - smoothstep(0.0, 0.22 + mottle * 0.06, burnDist);
        vec3 toasted = mix(diffuseColor.rgb, vec3(0.5, 0.31, 0.13) * (0.8 + mottle * 0.4), 0.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, toasted, heat * heat);

        float charWidth = 0.028 + edgeWarp * 0.022;
        float charred = 1.0 - smoothstep(-0.01, charWidth, burnDist);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.028, 0.018) * (0.7 + mottle * 0.6), charred);

        float ashBand = smoothstep(-0.016, -0.026, burnDist);
        float veins = smoothstep(0.55, 0.62, inkFbm(pageUv * 70.0 + 5.1));
        vec3 ashColor = mix(vec3(0.34, 0.32, 0.3), vec3(0.12, 0.11, 0.1), veins) * (0.75 + edgeWarp * 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, ashColor, ashBand);

        float pulse = 0.85 + 0.15 * inkNoise(pageUv * 12.0 + vec2(uTime * 1.7, uTime * 1.3));
        float lineMask = smoothstep(-0.017, -0.009, burnDist) * (1.0 - smoothstep(-0.003, 0.002, burnDist));
        float lineCrawl = smoothstep(0.35, 0.75, crawl);
        float core = smoothstep(0.62, 0.8, crawl);
        float smoulder = smoothstep(0.6, 0.72, inkFbm(pageUv * 90.0 + vec2(0.0, uTime * 0.25)))
          * smoothstep(-0.03, -0.012, burnDist) * (1.0 - smoothstep(0.0, charWidth, burnDist));

        float lineGlow = lineMask * (0.25 + 0.75 * lineCrawl) * pulse;
        burnGlow = lineGlow * 0.8 + smoulder * 0.3;
        burnColor = mix(vec3(1.25, 0.26, 0.03), vec3(1.9, 0.75, 0.12), core * lineMask);
      }`,
    )
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += burnColor * burnGlow;`,
    );
  };
  material.customProgramCacheKey = () => "ink-page";
  return { material, uniforms };
}
