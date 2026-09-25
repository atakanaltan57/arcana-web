"use client";

import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { isCompactDevice } from "@/lib/device";

const TEXTURE_SIZE = typeof window !== "undefined" && isCompactDevice() ? "512" : "1k";

export type PbrSet =
  | "medieval_wood"
  | "rusty_metal_03"
  | "rock_05"
  | "medieval_blocks_03"
  | "cobblestone_floor_001"
  | "wood_table_001";

export type PbrTextures = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

function paths(set: PbrSet) {
  return {
    map: `/textures/${set}_diff_${TEXTURE_SIZE}.jpg`,
    normalMap: `/textures/${set}_nor_gl_${TEXTURE_SIZE}.jpg`,
    roughnessMap: `/textures/${set}_rough_${TEXTURE_SIZE}.jpg`,
  };
}

export function usePbrTextures(set: PbrSet, repeat: [number, number], rotation = 0): PbrTextures {
  const loaded = useTexture(paths(set));
  const textures = useMemo(() => {
    const configure = (source: THREE.Texture, srgb: boolean) => {
      const texture = source.clone();
      texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
      texture.rotation = rotation;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      return texture;
    };
    return {
      map: configure(loaded.map, true),
      normalMap: configure(loaded.normalMap, false),
      roughnessMap: configure(loaded.roughnessMap, false),
    };
  }, [loaded, repeat, rotation]);

  useEffect(
    () => () => {
      textures.map.dispose();
      textures.normalMap.dispose();
      textures.roughnessMap.dispose();
    },
    [textures],
  );

  return textures;
}

export function preloadPbrTextures(sets: PbrSet[]) {
  sets.forEach((set) => useTexture.preload(Object.values(paths(set))));
}
