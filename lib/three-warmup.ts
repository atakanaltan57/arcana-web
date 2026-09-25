import * as THREE from "three";

const TEXTURES_PER_FRAME = 3;

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function collectTextures(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
      const uniforms = (material as THREE.ShaderMaterial).uniforms;
      if (uniforms) {
        for (const uniform of Object.values(uniforms)) {
          if (uniform?.value instanceof THREE.Texture) textures.add(uniform.value);
        }
      }
    }
  });
  return [...textures];
}

export async function warmScene(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, isCancelled: () => boolean) {
  try {
    await gl.compileAsync(scene, camera);
  } catch (error) {
    console.error("Shader warm-up failed", error);
  }
  const textures = collectTextures(scene);
  for (let i = 0; i < textures.length; i++) {
    if (isCancelled()) return;
    try {
      gl.initTexture(textures[i]);
    } catch (error) {
      console.error("Texture warm-up failed", error);
    }
    if ((i + 1) % TEXTURES_PER_FRAME === 0) await nextFrame();
  }
}
