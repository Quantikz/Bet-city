import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { prepareRealtimeAsset, normalizeAssetHeight, createRealtimeLOD } from './RealisticPipeline';
import type { Building, Streetlight, Prop } from '../world/City';
import type { FacadeStyle, PropType } from '../world/biome';
import { makeFacadeTexture, makeGlowTexture } from './textures';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const LAMP_HEIGHT = 5.2;

const UV_TILE = 24; // world units per full facade-texture tile (~3 units/window)

/**
 * Mesh factories. Buildings share a small pool of facade textures and a cached
 * material-per-(texture x tint) set, so hundreds of towers cost only a handful
 * of materials. Per-building geometry carries custom UV scaling so window rows
 * track each tower's real height.
 */
const FACADE_STYLES: FacadeStyle[] = ['glass', 'brick', 'concrete'];

// CC0 skinned humanoid with a real skeleton and embedded walk/idle clips.
// Skin weights make elbows, knees, shoulders and hips deform with the bones.
const REAL_HUMAN_URL = '/models/human.glb';
let realisticHumanTemplate: THREE.Group | null = null;
let realisticHumanAnimations: THREE.AnimationClip[] = [];
let realisticHumanLoading: Promise<void> | null = null;
const realisticHumanTargets: Array<{ target: THREE.Group; shirtColor: number; skinTone: number }> = [];

interface HumanRig {
  mixer: THREE.AnimationMixer;
  idle?: THREE.AnimationAction;
  walk?: THREE.AnimationAction;
  current: THREE.AnimationAction | null;
}

const humanRigs = new WeakMap<THREE.Group, HumanRig>();

function setupHumanRig(target: THREE.Group, model: THREE.Object3D, shirtColor = 0x3b82f6, skinTone = 0x8b5a3c): void {
  target.clear();

  // Normalize every imported human to real-world game scale. Cars are roughly
  // 4m long, so an adult must be about 1.75m tall rather than inheriting the
  // arbitrary GLB authoring units.
  normalizeAssetHeight(model, 1.75);
  prepareRealtimeAsset(model, { skinTone, accentColor: shirtColor, roughness: 0.55 });
  target.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const idleClip = realisticHumanAnimations.find((clip) => /idle|stand|rest/i.test(clip.name)) ?? realisticHumanAnimations[0];
  const walkClip = realisticHumanAnimations.find((clip) => /walk|locomot/i.test(clip.name)) ?? realisticHumanAnimations[1] ?? idleClip;
  const idle = idleClip ? mixer.clipAction(idleClip) : undefined;
  const walk = walkClip ? mixer.clipAction(walkClip) : undefined;
  if (idle) idle.play();
  humanRigs.set(target, { mixer, idle, walk, current: idle ?? null });
}


function scaleFacadeUvs(geo: THREE.BoxGeometry, w: number, h: number, d: number): void {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const set = (face: number, su: number, sv: number): void => {
    const base = face * 8;
    for (let i = 0; i < 4; i++) {
      uv.array[base + i * 2] *= su;
      uv.array[base + i * 2 + 1] *= sv;
    }
  };
  // Repeat a WHOLE number of tiles per face: a fractional repeat leaves a
  // partial tile at the seam that slices windows in half (worst on the big,
  // sparse brick facades). Rounding to integer tiles keeps every window intact;
  // window size then varies slightly per building, which reads fine.
  const ru = (n: number) => Math.max(1, Math.round(n / UV_TILE));
  set(0, ru(d), ru(h)); // +X
  set(1, ru(d), ru(h)); // -X
  set(2, 0, 0); // +Y roof
  set(3, 0, 0); // -Y floor
  set(4, ru(w), ru(h)); // +Z
  set(5, ru(w), ru(h)); // -Z
  uv.needsUpdate = true;
}

export interface CarMesh {
  group: THREE.Group;
  /** Front wheels, rotated for a visual steering cue. */
  steerWheels: THREE.Object3D[];
}

/** Give every vertex of a geometry the same colour (for merged, vertex-coloured props). */
function paint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry =>
  mergeGeometries(parts) as THREE.BufferGeometry;

/** A little conifer: brown trunk + green canopy, base at y=0. */
function makeTreeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.16, 0.22, 1.2, 6);
  trunk.translate(0, 0.6, 0);
  const canopy = new THREE.ConeGeometry(1.1, 2.6, 8);
  canopy.translate(0, 2.5, 0);
  return merge([paint(trunk, 0x6b4a2f), paint(canopy, 0x2f5d3a)]);
}

/** A fire hydrant: stout body, domed cap, two side nozzles. */
function makeHydrantGeometry(): THREE.BufferGeometry {
  const red = 0xb5402f;
  const body = new THREE.CylinderGeometry(0.2, 0.24, 0.7, 8);
  body.translate(0, 0.35, 0);
  const dome = new THREE.SphereGeometry(0.2, 8, 6);
  dome.translate(0, 0.7, 0);
  const noz = new THREE.CylinderGeometry(0.07, 0.07, 0.28, 6);
  noz.rotateZ(Math.PI / 2);
  const left = noz.clone();
  left.translate(-0.26, 0.42, 0);
  const right = noz.clone();
  right.translate(0.26, 0.42, 0);
  return merge([body, dome, left, right].map((g) => paint(g, red)));
}

/** A park bench: seat, backrest, two legs. */
function makeBenchGeometry(): THREE.BufferGeometry {
  const dark = 0x33363d;
  const seat = new THREE.BoxGeometry(1.5, 0.12, 0.5);
  seat.translate(0, 0.45, 0);
  const back = new THREE.BoxGeometry(1.5, 0.4, 0.1);
  back.translate(0, 0.66, -0.2);
  const legGeo = new THREE.BoxGeometry(0.12, 0.45, 0.45);
  const legL = legGeo.clone();
  legL.translate(-0.65, 0.22, 0);
  const legR = legGeo.clone();
  legR.translate(0.65, 0.22, 0);
  return merge([seat, back, legL, legR].map((g) => paint(g, dark)));
}

/**
 * A car body silhouette. Dimensions stay close to the shared collision circle
 * (CAR_RADIUS), so variety is visual — proportions, ride height, cabin shape —
 * not a physics change (per-car mass/radius is R003). `cabinX` shifts the cabin
 * fore/aft (a pickup's cab sits forward; a van's is long and tall).
 */
export interface CarShape {
  id: string;
  length: number;
  width: number;
  bodyH: number; // body box height
  bodyY: number; // body centre height (ride)
  cabinLen: number;
  cabinH: number;
  cabinX: number; // cabin offset along length (+front)
  wheelR: number;
}

export const CAR_SHAPES: CarShape[] = [
  { id: 'sedan', length: 4.0, width: 1.9, bodyH: 0.7, bodyY: 0.65, cabinLen: 2.1, cabinH: 0.7, cabinX: -0.2, wheelR: 0.45 },
  { id: 'compact', length: 3.5, width: 1.8, bodyH: 0.72, bodyY: 0.62, cabinLen: 1.6, cabinH: 0.74, cabinX: -0.1, wheelR: 0.42 },
  { id: 'sports', length: 4.3, width: 1.86, bodyH: 0.55, bodyY: 0.5, cabinLen: 1.8, cabinH: 0.5, cabinX: -0.35, wheelR: 0.44 },
  { id: 'van', length: 4.4, width: 2.0, bodyH: 1.0, bodyY: 0.8, cabinLen: 2.7, cabinH: 1.0, cabinX: 0.1, wheelR: 0.46 },
  { id: 'pickup', length: 4.4, width: 1.96, bodyH: 0.8, bodyY: 0.72, cabinLen: 1.5, cabinH: 0.95, cabinX: 0.55, wheelR: 0.48 },
];

export function makeCar(color: number, shape: CarShape = CAR_SHAPES[0]): CarMesh {
  const group = new THREE.Group();
  const hl = shape.length / 2;
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(shape.length, shape.bodyH, shape.width, 3, 0.16),
    new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.24, envMapIntensity: 1.5 }),
  );
  body.position.y = shape.bodyY;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new RoundedBoxGeometry(shape.cabinLen, shape.cabinH, shape.width - 0.34, 3, 0.12),
    new THREE.MeshPhysicalMaterial({
      color: 0x14202a, metalness: 0.05, roughness: 0.12, transmission: 0.08,
      transparent: true, opacity: 0.88, envMapIntensity: 1.8,
    }),
  );
  cabin.position.set(shape.cabinX, shape.bodyY + shape.bodyH / 2 + shape.cabinH / 2, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const lowerMat = new THREE.MeshStandardMaterial({ color: 0x17191d, metalness: 0.35, roughness: 0.55 });
  const bumper = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.25, shape.width * 0.82, 2, 0.05), lowerMat);
  bumper.position.set(hl + 0.02, shape.bodyY - 0.18, 0);
  group.add(bumper);
  const rearBumper = bumper.clone();
  rearBumper.position.x = -hl - 0.02;
  group.add(rearBumper);

  const grille = new THREE.Mesh(
    new RoundedBoxGeometry(0.04, 0.22, shape.width * 0.42, 2, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x080a0d, metalness: 0.6, roughness: 0.3 }),
  );
  grille.position.set(hl + 0.08, shape.bodyY + 0.02, 0);
  group.add(grille);

  const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x101419, metalness: 0.55, roughness: 0.28 });
  for (const z of [-shape.width / 2 - 0.08, shape.width / 2 + 0.08]) {
    const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.1, 0.18, 2, 0.04), mirrorMat);
    mirror.position.set(shape.cabinX + shape.cabinLen * 0.32, shape.bodyY + shape.bodyH / 2 + shape.cabinH * 0.42, z);
    group.add(mirror);
  }

  const wheelGeo = new THREE.CylinderGeometry(shape.wheelR, shape.wheelR, 0.32, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.92 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb6bcc4, metalness: 0.9, roughness: 0.22 });
  const axle = shape.length * 0.32;
  const track = shape.width / 2;
  const steerWheels: THREE.Object3D[] = [];
  for (const wx of [axle, -axle]) {
    for (const wz of [track, -track]) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(wx, shape.wheelR, wz);
      wheel.castShadow = true;
      group.add(wheel);
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(shape.wheelR * 0.52, shape.wheelR * 0.52, 0.34, 16),
        rimMat,
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.copy(wheel.position);
      rim.position.z += wz > 0 ? -0.03 : 0.03;
      group.add(rim);
      if (wx > 0) steerWheels.push(wheel);
    }
  }

  const head = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xfff0c0, emissiveIntensity: 3, roughness: 0.2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x551015, emissive: 0xff2030, emissiveIntensity: 1.4, roughness: 0.3 });
  for (const lz of [shape.width * 0.3, -shape.width * 0.3]) {
    const hlMesh = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.25, 0.3, 2, 0.03), head);
    hlMesh.position.set(hl, shape.bodyY + 0.02, lz);
    group.add(hlMesh);
    const tl = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.25, 0.3, 2, 0.03), tail);
    tl.position.set(-hl, shape.bodyY + 0.02, lz);
    group.add(tl);
  }
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.receiveShadow = true;
  });
  return { group, steerWheels };
}
export function makePed(color: number): THREE.Group {
  // Keep the beta character renderer deterministic and dependency-free.
  // The GLB rig is retained in the repo for the next character pass, but we
  // do not replace a visible character asynchronously until its render path
  // has been validated on mobile GPUs.
  const group = new THREE.Group();
  const skinTone = [0x4b2d1e, 0x6b3f29, 0x8b5a3c, 0xa96f4f, 0xc58a68][Math.abs(Math.trunc(color)) % 5];
  const skin = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.72 });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x263142, roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.92 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0): void => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  add(new THREE.CylinderGeometry(0.24, 0.29, 0.62, 10), shirt, 0, 1.05);
  add(new THREE.SphereGeometry(0.105, 10, 8), skin, 0, 1.42);
  add(new THREE.SphereGeometry(0.22, 16, 12), skin, 0, 1.66);
  add(new THREE.SphereGeometry(0.225, 16, 8), new THREE.MeshStandardMaterial({ color: 0x17110e, roughness: 0.9 }), 0, 1.77);
  add(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), shirt, -0.30, 1.08);
  add(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), shirt, 0.30, 1.08);
  add(new THREE.SphereGeometry(0.08, 8, 6), skin, -0.32, 0.79);
  add(new THREE.SphereGeometry(0.08, 8, 6), skin, 0.32, 0.79);
  add(new THREE.CapsuleGeometry(0.095, 0.48, 4, 8), pants, -0.12, 0.48);
  add(new THREE.CapsuleGeometry(0.095, 0.48, 4, 8), pants, 0.12, 0.48);
  add(new THREE.BoxGeometry(0.20, 0.10, 0.38), shoes, -0.12, 0.08, -0.06);
  add(new THREE.BoxGeometry(0.20, 0.10, 0.38), shoes, 0.12, 0.08, -0.06);
  return group;
}

