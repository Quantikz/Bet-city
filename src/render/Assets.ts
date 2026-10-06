import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createRealtimeLOD } from './RealisticPipeline';
import type { Building, Streetlight, Prop } from '../world/City';
import type { FacadeStyle, PropType } from '../world/biome';
import { makeFacadeTexture, makeGlowTexture } from './textures';

const LAMP_HEIGHT = 5.2;

const UV_TILE = 24; // world units per full facade-texture tile (~3 units/window)

/**
 * Mesh factories. Buildings share a small pool of facade textures and a cached
 * material-per-(texture x tint) set, so hundreds of towers cost only a handful
 * of materials. Per-building geometry carries custom UV scaling so window rows
 * track each tower's real height.
 */
const FACADE_STYLES: FacadeStyle[] = ['glass', 'brick', 'concrete'];

/** Procedural beta humans do not use skeletal animation yet; keep these hooks stable. */
export function updateHumanAnimation(group: THREE.Group, speed: number, dt: number): void {
  // Lightweight procedural animation keeps the beta characters visibly alive
  // without relying on the unvalidated GLB rig.  Parts are named in makePed().
  const walk = Math.min(1, Math.max(0, speed / 2.2));
  const t = performance.now() * 0.012;
  const swing = Math.sin(t * (0.75 + walk * 1.8)) * 0.65 * walk;
  const leftArm = group.getObjectByName('ped-arm-l');
  const rightArm = group.getObjectByName('ped-arm-r');
  const leftLeg = group.getObjectByName('ped-leg-l');
  const rightLeg = group.getObjectByName('ped-leg-r');
  if (leftArm) leftArm.rotation.z = swing;
  if (rightArm) rightArm.rotation.z = -swing;
  if (leftLeg) leftLeg.rotation.z = -swing * 0.55;
  if (rightLeg) rightLeg.rotation.z = swing * 0.55;
  group.position.y += Math.sin(t * 2.2) * 0.003 * walk * Math.min(1, dt * 60);
}
export function freezeHumanAnimation(group: THREE.Group): void {
  for (const name of ['ped-arm-l', 'ped-arm-r', 'ped-leg-l', 'ped-leg-r']) {
    const part = group.getObjectByName(name);
    if (part) part.rotation.z = 0;
  }
}

export class CityAssets {
  private readonly facadesByStyle: Record<FacadeStyle, THREE.CanvasTexture[]>;
  private readonly sideCache = new Map<string, THREE.Material>();
  private readonly roofMat: THREE.Material;

  // Shared across every streetlight so the whole grid of lamps costs a handful
  // of GPU resources, not one set per pole.
  private readonly poleGeo = new THREE.CylinderGeometry(0.13, 0.18, LAMP_HEIGHT, 8);
  private readonly headGeo = new THREE.SphereGeometry(0.42, 12, 10);
  private readonly poolGeo = new THREE.PlaneGeometry(11, 11);
  private readonly poleMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.7, metalness: 0.4 });
  private readonly headMat = new THREE.MeshStandardMaterial({
    color: 0xffe6bf,
    emissive: 0xffd9a0,
    emissiveIntensity: 3,
  });
  private readonly poolMat: THREE.Material;

  // Shared prototype geometry+material per prop type; each geometry is shifted so
  // its base sits at y=0, so an instance matrix only needs world x/z + rotation.
  private readonly propProto: Record<PropType, { geo: THREE.BufferGeometry; mat: THREE.Material }>;

  constructor(seed: number, variants = 3) {
    // A small pool of texture variants per facade style; buildings draw from the
    // pool matching their biome-assigned style, so the skyline isn't all glass.
    this.facadesByStyle = { glass: [], brick: [], concrete: [] };
    FACADE_STYLES.forEach((style, s) => {
      for (let i = 0; i < variants; i++) {
        this.facadesByStyle[style].push(makeFacadeTexture(seed + s * 1000 + i * 101, style));
      }
    });
    this.roofMat = new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.95 });
    this.poolMat = new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
    });

    // Each prop is several primitives merged into ONE vertex-coloured geometry,
    // so a whole prop type still renders as a single InstancedMesh while looking
    // like an actual tree / hydrant / bench instead of a bare cone or box.
    const vc = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    this.propProto = {
      tree: { geo: makeTreeGeometry(), mat: vc() },
      hydrant: { geo: makeHydrantGeometry(), mat: vc() },
      bench: { geo: makeBenchGeometry(), mat: vc() },
    };
  }

  /** One InstancedMesh per prop type (a few draw calls for the whole map). */
  makeProps(props: Prop[]): THREE.Group {
    const group = new THREE.Group();
    const byType: Record<PropType, Prop[]> = { tree: [], hydrant: [], bench: [] };
    for (const p of props) byType[p.type].push(p);

    const dummy = new THREE.Object3D();
    for (const type of Object.keys(byType) as PropType[]) {
      const list = byType[type];
      if (list.length === 0) continue;
      const { geo, mat } = this.propProto[type];
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      inst.castShadow = true;
      list.forEach((p, i) => {
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    }
    return group;
  }

  makeStreetlight(s: Streetlight): THREE.Group {
    const g = new THREE.Group();

    const pole = new THREE.Mesh(this.poleGeo, this.poleMat);
    pole.position.y = LAMP_HEIGHT / 2;
    pole.castShadow = true;
    g.add(pole);

    const head = new THREE.Mesh(this.headGeo, this.headMat);
    head.position.y = LAMP_HEIGHT;
    g.add(head);

    const pool = new THREE.Mesh(this.poolGeo, this.poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.05; // hover just above the road to avoid z-fighting
    g.add(pool);

    g.position.set(s.x, 0, s.z);
    return g;
  }

  makeBuilding(b: Building, index: number): THREE.Object3D {
    const geo = new THREE.BoxGeometry(b.width, b.height, b.depth);
    scaleFacadeUvs(geo, b.width, b.height, b.depth);
    const pool = this.facadesByStyle[b.style];
    const facade = pool[index % pool.length];
    const side = this.sideMaterial(facade, b.color);

    const far = new THREE.Mesh(geo, [side, side, this.roofMat, this.roofMat, side, side]);
    far.position.set(b.cx, b.height / 2, b.cz);
    far.castShadow = true;
    far.receiveShadow = true;

    const near = new THREE.Group();
    near.add(far.clone());
    const trimMat = new THREE.MeshStandardMaterial({
      color: b.style === 'glass' ? 0x1c2632 : 0x30343b,
      metalness: b.style === 'glass' ? 0.55 : 0.18,
      roughness: b.style === 'glass' ? 0.28 : 0.72,
    });
    const plinth = new THREE.Mesh(
      new RoundedBoxGeometry(Math.max(3, b.width + 0.35), 0.65, Math.max(3, b.depth + 0.35), 2, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.9 }),
    );
    plinth.position.set(b.cx, 0.33, b.cz);
    near.add(plinth);
    const roof = new THREE.Mesh(
      new RoundedBoxGeometry(b.width + 0.3, 0.45, b.depth + 0.3, 2, 0.08),
      trimMat,
    );
    roof.position.set(b.cx, b.height + 0.18, b.cz);
    near.add(roof);
    if (b.height > 18) {
      const finGeo = new THREE.BoxGeometry(0.22, b.height - 1.5, 0.28);
      for (const x of [b.cx - b.width / 2 + 0.22, b.cx + b.width / 2 - 0.22]) {
        const fin = new THREE.Mesh(finGeo, trimMat);
        fin.position.set(x, b.height / 2 + 0.55, b.cz + b.depth / 2 + 0.06);
        near.add(fin);
      }
    }
    const door = new THREE.Mesh(
      new RoundedBoxGeometry(1.5, 2.6, 0.10, 2, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x18212a, metalness: 0.15, roughness: 0.3 }),
    );
    door.position.set(b.cx, 1.3, b.cz + b.depth / 2 + 0.055);
    near.add(door);
    const canopy = new THREE.Mesh(
      new RoundedBoxGeometry(2.1, 0.12, 0.75, 2, 0.05),
      trimMat,
    );
    canopy.position.set(b.cx, 2.72, b.cz + b.depth / 2 + 0.3);
    near.add(canopy);
    if (b.height > 28) {
      const acMat = new THREE.MeshStandardMaterial({ color: 0x6b727b, metalness: 0.5, roughness: 0.6 });
      for (let i = 0; i < 2; i++) {
        const ac = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.9, 1.1, 2, 0.12), acMat);
        ac.position.set(b.cx - b.width * 0.2 + i * b.width * 0.4, b.height + 0.72, b.cz - b.depth * 0.15);
        near.add(ac);
      }
    }
    near.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
    });
    return createRealtimeLOD(near, far, 0, 72);
  }

  /**
   * Day/night: lit windows and lamp heads shouldn't glow in daylight, so scale
   * their emissive by the daylight factor (`d`: 0 night → 1 noon). By day the
   * facades also turn glassier (lower roughness, higher metalness) so windows
   * read as reflective glass instead of dark holes.
   */
  setDaylight(d: number): void {
    const lit = 1 - 0.92 * d; // full glow at night → nearly off at noon
    for (const m of this.sideCache.values()) {
      const sm = m as THREE.MeshStandardMaterial;
      sm.emissiveIntensity = 1.8 * lit;
      sm.roughness = 0.75 - 0.5 * d;
      sm.metalness = 0.05 + 0.5 * d;
    }
    this.headMat.emissiveIntensity = 3 * lit;
    (this.poolMat as THREE.MeshBasicMaterial).opacity = 0.9 * lit;
  }

  private sideMaterial(facade: THREE.CanvasTexture, tint: number): THREE.Material {
    const key = `${facade.uuid}:${tint}`;
    let mat = this.sideCache.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: tint,
        map: facade,
        emissive: 0xffffff,
        emissiveMap: facade,
        emissiveIntensity: 1.8,
        roughness: 0.75,
        metalness: 0.05,
      });
      this.sideCache.set(key, mat);
    }
    return mat;
  }
}

/** Scale per-face UVs so windows tile by real dimensions; roof/floor collapse to the dark texel. */
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
  const group = new THREE.Group();
  const skinTone = [0x4b2d1e, 0x6b3f29, 0x8b5a3c, 0xa96f4f, 0xc58a68][Math.abs(Math.trunc(color)) % 5];
  const skin = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.72 });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x263142, roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.92 });
  const add = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add('ped-body', new THREE.CylinderGeometry(0.24, 0.29, 0.62, 10), shirt, 0, 1.05);
  add('ped-neck', new THREE.CylinderGeometry(0.09, 0.09, 0.16, 8), skin, 0, 1.42);
  add('ped-head', new THREE.SphereGeometry(0.22, 16, 12), skin, 0, 1.66);
  add('ped-hair', new THREE.SphereGeometry(0.225, 16, 8), new THREE.MeshStandardMaterial({ color: 0x17110e, roughness: 0.9 }), 0, 1.77);
  add('ped-arm-l', new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), shirt, -0.30, 1.08);
  add('ped-arm-r', new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), shirt, 0.30, 1.08);
  add('ped-hand-l', new THREE.SphereGeometry(0.08, 8, 6), skin, -0.32, 0.79);
  add('ped-hand-r', new THREE.SphereGeometry(0.08, 8, 6), skin, 0.32, 0.79);
  add('ped-leg-l', new THREE.CapsuleGeometry(0.095, 0.48, 4, 8), pants, -0.12, 0.48);
  add('ped-leg-r', new THREE.CapsuleGeometry(0.095, 0.48, 4, 8), pants, 0.12, 0.48);
  add('ped-shoe-l', new THREE.BoxGeometry(0.20, 0.10, 0.38), shoes, -0.12, 0.08, -0.06);
  add('ped-shoe-r', new THREE.BoxGeometry(0.20, 0.10, 0.38), shoes, 0.12, 0.08, -0.06);
  return group;
}
