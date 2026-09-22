import * as THREE from "three";

export type CoverUniforms = {
  uIgnite: { value: number };
  uSparkle: { value: number };
  uTime: { value: number };
  uGlint: { value: THREE.Vector3 };
  uCandle: { value: THREE.Vector3 };
  uGem: { value: number };
};

export function enhanceCoverMaterial(material: THREE.MeshStandardMaterial, candle: [number, number, number]) {
  const uniforms: CoverUniforms = {
    uIgnite: { value: 1.2 },
    uSparkle: { value: 8 },
    uTime: { value: 0 },
    uGlint: { value: new THREE.Vector3(1.5, 3.4, 3.2) },
    uCandle: { value: new THREE.Vector3(...candle) },
    uGem: { value: 1 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `uniform float uIgnite;
uniform float uSparkle;
uniform float uTime;
uniform vec3 uGlint;
uniform vec3 uCandle;
uniform float uGem;
${shader.fragmentShader}`
      .replace(
        "#include <emissivemap_fragment>",
        `#ifdef USE_EMISSIVEMAP
          vec4 emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);
          float igniteDist = emissiveColor.g;
          float lit = smoothstep(igniteDist - 0.05, igniteDist + 0.01, uIgnite);
          float frontGlow = exp(-pow((uIgnite - igniteDist) * 16.0, 2.0)) * (1.0 - step(1.1, uIgnite));
          totalEmissiveRadiance *= emissiveColor.r * (lit + frontGlow * 1.8);
          float gemFacet = 0.75 + 0.25 * sin(vEmissiveMapUv.x * 900.0 + vEmissiveMapUv.y * 700.0 + uTime * 3.0);
          totalEmissiveRadiance += vec3(1.0, 0.86, 0.62) * emissiveColor.b * uGem * gemFacet;
        #endif`,
      )
      .replace(
        "#include <opaque_fragment>",
        `vec2 glitterGrid = vMapUv * vec2(420.0, 580.0);
        vec2 glitterCell = floor(glitterGrid);
        vec2 glitterLocal = fract(glitterGrid) - 0.5;
        float gh1 = fract(sin(dot(glitterCell, vec2(12.9898, 78.233))) * 43758.5453);
        float gh2 = fract(sin(dot(glitterCell, vec2(39.3468, 11.135))) * 24634.6345);
        float gh3 = fract(sin(dot(glitterCell, vec2(73.156, 52.235))) * 14375.5964);
        vec3 facet = normalize(normal + (vec3(gh1, gh2, gh3) - 0.5) * 1.15);
        vec3 toEye = normalize(vViewPosition);
        vec3 fragView = -vViewPosition;
        vec3 glintDir = normalize((viewMatrix * vec4(uGlint, 1.0)).xyz - fragView);
        vec3 candleDir = normalize((viewMatrix * vec4(uCandle, 1.0)).xyz - fragView);
        float glintSpec = pow(max(dot(reflect(-glintDir, facet), toEye), 0.0), 420.0);
        float candleSpec = pow(max(dot(reflect(-candleDir, facet), toEye), 0.0), 420.0);
        float glitterShape = 1.0 - smoothstep(0.04, 0.42, length(glitterLocal));
        float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + gh3 * 4.0) + gh1 * 40.0);
        float sparkle = (glintSpec + candleSpec * 1.6) * glitterShape * twinkle * smoothstep(0.5, 0.9, metalnessFactor);
        outgoingLight += vec3(1.0, 0.84, 0.55) * sparkle * uSparkle;
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "cover-gold";
  return uniforms;
}
