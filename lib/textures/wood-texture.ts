import * as THREE from "three";
import {
  canvasToTexture,
  createCanvas,
  heightToNormalCanvas,
  seededRandom,
  smoothNoiseField,
} from "./procedural";

export type WoodTextures = {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  dispose: () => void;
};

export function createWoodTextures(): WoodTextures {
  const size = 1024;
  const rand = seededRandom(42);
  const grain = smoothNoiseField(size, size, rand, [
    { size: 60, weight: 1, stretchX: 14 },
    { size: 14, weight: 0.7, stretchX: 22 },
    { size: 4, weight: 0.35, stretchX: 30 },
  ]);
  const figure = smoothNoiseField(size, size, rand, [
    { size: 200, weight: 1, stretchX: 3 },
    { size: 70, weight: 0.4, stretchX: 5 },
  ]);

  const plankCount = 4;
  const plankHeight = size / plankCount;
  const plankTone = Array.from({ length: plankCount }, () => 0.85 + rand() * 0.3);

  const color = createCanvas(size, size);
  const rough = createCanvas(size, size);
  const colorImage = color.ctx.createImageData(size, size);
  const roughImage = rough.ctx.createImageData(size, size);
  const heightField = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const plank = Math.floor(y / plankHeight);
    const inPlank = y - plank * plankHeight;
    const seam = inPlank < 2 || inPlank > plankHeight - 2 ? 1 : 0;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const rings = 0.5 + 0.5 * Math.sin((grain[i] * 18 + figure[i] * 6) * Math.PI);
      const tone = plankTone[plank] * (0.62 + rings * 0.28 + figure[i] * 0.22) * (seam ? 0.35 : 1);
      colorImage.data[i * 4] = 52 * tone;
      colorImage.data[i * 4 + 1] = 32 * tone;
      colorImage.data[i * 4 + 2] = 21 * tone;
      colorImage.data[i * 4 + 3] = 255;
      const r = (0.42 + (1 - rings) * 0.2 + seam * 0.3) * 255;
      roughImage.data[i * 4] = r;
      roughImage.data[i * 4 + 1] = r;
      roughImage.data[i * 4 + 2] = r;
      roughImage.data[i * 4 + 3] = 255;
      heightField[i] = rings * 0.35 + grain[i] * 0.3 - seam * 1.5;
    }
  }
  color.ctx.putImageData(colorImage, 0, 0);
  rough.ctx.putImageData(roughImage, 0, 0);

  const map = canvasToTexture(color.canvas, true);
  const normalMap = canvasToTexture(heightToNormalCanvas(heightField, size, size, 1.6), false);
  const roughnessMap = canvasToTexture(rough.canvas, false);
  for (const texture of [map, normalMap, roughnessMap]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
  }
  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}
