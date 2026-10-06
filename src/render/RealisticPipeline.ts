import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface RealtimeAssetOptions { skinTone?: number; accentColor?: number; roughness?: number; }

export function normalizeAssetHeight(root: THREE.Object3D, targetHeight: number): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (size.y <= 0.001) return;
  root.scale.multiplyScalar(targetHeight / size.y);
  const scaled = new THREE.Box3().setFromObject(root);
  const center = scaled.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaled.min.y;
}

export function prepareRealtimeAsset(root: THREE.Object3D, options: RealtimeAssetOptions = {}): void {
  const skinTone = options.skinTone ?? 0x8b5a3c;
  const accentColor = options.accentColor ?? 0x3b82f6;
  const roughness = options.roughness ?? 0.55;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = sources.map((source) => {
      const material = source.clone() as THREE.MeshStandardMaterial;
      const label = (mesh.name + ' ' + material.name).toLowerCase();
      if (label.includes('skin') || label.includes('face') || label.includes('body')) material.color.setHex(skinTone);
      else if (label.includes('hair')) material.color.setHex(0x17120f);
      else if (label.includes('shirt') || label.includes('cloth') || label.includes('top') || label.includes('pants')) material.color.setHex(accentColor);
      if ('roughness' in material) material.roughness = Math.max(material.roughness, roughness);
      if ('envMapIntensity' in material) material.envMapIntensity = 1.2;
      return material;
    });
  });
}

export function createRealtimeLOD(near: THREE.Object3D, far: THREE.Object3D, nearDistance = 0, farDistance = 70): THREE.LOD {
  const lod = new THREE.LOD();
  lod.addLevel(near, nearDistance);
  lod.addLevel(far, farDistance);
  lod.autoUpdate = true;
  return lod;
}

export async function loadRealtimeGLTF(url: string): Promise<THREE.Group> {
  const gltf = await new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>((resolve, reject) => {
    new GLTFLoader().load(url, resolve, undefined, reject);
  });
  return gltf.scene;
}