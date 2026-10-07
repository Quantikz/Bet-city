import * as THREE from 'three';
import { daylightFactor, sunPosition } from '../core/math';
import { makeGlowTexture } from './textures';
import type { City } from '../world/City';

/**
 * Owns the renderer, scene graph, camera and the static environment (ground +
 * road grid + dusk lighting). A single directional light covers the whole city
 * for shadows; everything else is emissive, which keeps the night look cheap.
 */
export interface SceneQuality {
  maxPixelRatio?: number; // cap device pixel ratio (lower = cheaper)
  shadowMapSize?: number; // directional shadow resolution
  streaming?: boolean; // streamed world: ground/shadow/sun follow the player (R007)
}

// In streamed mode the shadow frustum is a tight window around the player rather
// than the whole (unbounded) world.
const STREAM_SHADOW_HALF = 90;

// Night (t=0, the original look) ↔ day palette, lerped by the daylight factor.
const NIGHT = {
  sky: 0x52677d,
  ambient: { color: 0x93a9bd, intensity: 1.45 },
  hemiSky: 0x9ab4cc,
  sun: { color: 0xe8f2ff, intensity: 3.0 },
};
const DAY = {
  sky: 0xd9ecf7,
  ambient: { color: 0xd4e2ee, intensity: 1.55 },
  hemiSky: 0xc4e0f4,
  sun: { color: 0xfff9ed, intensity: 4.0 },
};

export class SceneEnv {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private ambient!: THREE.AmbientLight;
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private sunDisc!: THREE.Sprite;
  private sunRadius = 0;
  private ground!: THREE.Mesh;
  private readonly streaming: boolean;
  private followX = 0;
  private followZ = 0;
  private readonly shadowHalf: number;
  private readonly houseLights: THREE.PointLight[];

  constructor(container: HTMLElement, city: City, quality: SceneQuality = {}) {
    const maxPixelRatio = quality.maxPixelRatio ?? 2;
    const shadowMapSize = quality.shadowMapSize ?? 2048;
    this.streaming = !!quality.streaming;
    // Finite world: the shadow frustum spans the whole map. Streamed world: a
    // tight window that follows the player (city.half is effectively unbounded).
    this.shadowHalf = this.streaming ? STREAM_SHADOW_HALF : city.half;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.85;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x52677d);
    this.scene.fog = new THREE.Fog(0x52677d, city.extent * 0.18, city.extent * 0.7);

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.5,
      city.extent * 1.5,
    );
    this.camera.position.set(0, 30, 30);

    this.addLights(city, shadowMapSize);
    this.houseLights = Array.from({ length: 42 }, () => {
      const light = new THREE.PointLight(0xffd6a0, 9, 24, 2);
      light.castShadow = false;
      this.scene.add(light);
      return light;
    });
    this.addGround(city);
    this.addLandmarks(city);
    // Streamed roads are everywhere (the grid between blocks); the finite per-
    // roadCenter planes don't apply, so the ground reads as asphalt-dark instead.
    if (!this.streaming) this.addRoads(city);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  }

  private addLights(city: City, shadowMapSize: number): void {
    this.ambient = new THREE.AmbientLight(NIGHT.ambient.color, NIGHT.ambient.intensity);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(NIGHT.hemiSky, 0x0a0a12, 0.7);
    this.scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(NIGHT.sun.color, NIGHT.sun.intensity);
    sun.shadow.normalBias = 0.025;
    sun.position.set(city.half * 0.6, city.half * 1.2, city.half * 0.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    const cam = sun.shadow.camera;
    cam.left = -this.shadowHalf;
    cam.right = this.shadowHalf;
    cam.top = this.shadowHalf;
    cam.bottom = -this.shadowHalf;
    cam.near = 1;
    cam.far = city.extent * 2.5;
    sun.shadow.bias = -0.00025;
    this.scene.add(sun);
    this.scene.add(sun.target); // target stays at origin; moving the light sweeps shadows
    this.sun = sun;

    // A visible sun/moon disc that rides the same arc as the directional light.
    this.sunRadius = city.extent * 1.1; // inside the camera far plane (extent*1.5)
    const disc = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    disc.scale.setScalar(city.extent * 0.22);
    this.scene.add(disc);
    this.sunDisc = disc;
    this.setTimeOfDay(0.5); // start in bright midday for a clear beta presentation
  }

  /**
   * Drive the day/night look from a time-of-day in [0,1) (0 = midnight). Lerps
   * sky/fog colour and light colour+intensity between the night and day
   * palettes by a daylight factor (0 at night, 1 at noon), and rides the sun
   * (the shadow-casting directional light + a visible disc) along an east→
   * overhead→west arc so shadows sweep across the city through the day.
   */
  setTimeOfDay(t: number): void {
    const d = daylightFactor(t); // 0 night → 1 noon
    const mix = (a: number, b: number): THREE.Color => new THREE.Color(a).lerp(new THREE.Color(b), d);
    const lerpN = (a: number, b: number): number => a + (b - a) * d;

    const sky = mix(NIGHT.sky, DAY.sky);
    (this.scene.background as THREE.Color).copy(sky);
    (this.scene.fog as THREE.Fog).color.copy(sky);

    this.ambient.color.copy(mix(NIGHT.ambient.color, DAY.ambient.color));
    this.ambient.intensity = lerpN(NIGHT.ambient.intensity, DAY.ambient.intensity);
    this.hemi.color.copy(mix(NIGHT.hemiSky, DAY.hemiSky));
    this.sun.color.copy(mix(NIGHT.sun.color, DAY.sun.color));
    this.sun.intensity = lerpN(NIGHT.sun.intensity, DAY.sun.intensity);

    // Sweep the light + disc along the day's arc. The target sits at the follow
    // centre (origin in the finite world; the player in the streamed world), so
    // the shadow frustum rides along instead of being left behind.
    const dir = sunPosition(t);
    this.sun.position.set(
      this.followX + dir.x * this.sunRadius,
      dir.y * this.sunRadius,
      this.followZ + dir.z * this.sunRadius,
    );
    this.sun.target.position.set(this.followX, 0, this.followZ);
    this.sun.target.updateMatrixWorld();
    this.sunDisc.position.copy(this.sun.position);
    // Warm sun by day, pale moon by night; never fully invisible.
    this.sunDisc.material.color.copy(mix(0xaec6ff, 0xfff1c4));
    this.sunDisc.material.opacity = 0.45 + 0.4 * d;
  }

  private addGround(city: City): void {
    const size = city.extent * 2;
    // In the streamed world the ground is asphalt-dark (it stands in for the
    // road grid, which isn't drawn as planes) and follows the player.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: this.streaming ? 0x303743 : 0x262b35, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;
  }

  /** Landmark dressing: a richer, low-poly city layer built from shared materials. */
  private addLandmarks(city: City): void {
    const mat = (color: number, roughness = 0.88, emissive = 0): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity: emissive ? 1.4 : 0 });

    const plane = (color: number, w: number, d: number, x: number, z: number, y = 0.035): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    const box = (color: number, w: number, h: number, d: number, x: number, y: number, z: number, roughness = 0.8): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, roughness));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };

    // --- Coastal promenade / beach ---
    const coastZ = city.half - 18;
    plane(0xd8c28b, city.extent, 34, 0, coastZ);
    plane(0x177f9e, city.extent * 1.18, 120, 0, city.half + 42, -0.04);
    plane(0xb7a88d, city.extent, 3.2, 0, coastZ - 17);
    for (let x = -city.half + 10; x < city.half - 8; x += 22) {
      box(0x765f43, 0.45, 2.8, 0.45, x, 1.4, coastZ - 10);
      box(0xd8c9a7, 3.2, 0.18, 0.75, x, 2.65, coastZ - 10);
    }
    for (let x = -city.half + 8; x < city.half - 6; x += 18) {
      const trunk = box(0x6b4a2f, 0.45, 3.2, 0.45, x, 1.6, coastZ + 10);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.0, 2.8, 8), mat(0x2f6a3f));
      crown.position.set(x, 4.0, coastZ + 10);
      crown.castShadow = true;
      this.scene.add(crown);
      trunk.castShadow = true;
    }

    // --- Market square: stalls, awnings and central seating ---
    const mx = -city.half * 0.42, mz = city.half * 0.12;
    plane(0x8b8170, 34, 28, mx, mz);
    for (let i = -2; i <= 2; i++) {
      const x = mx + i * 6;
      box([0xc94d42, 0xe0ad43, 0x4e86c7][(i + 2) % 3], 4.5, 2.4, 3.2, x, 1.2, mz);
      box([0x8f302f, 0xb57e21, 0x315f98][(i + 2) % 3], 4.9, 0.12, 3.7, x, 2.55, mz);
      box(0x5a4435, 0.18, 2.1, 0.18, x - 2, 1.05, mz - 1.35);
      box(0x5a4435, 0.18, 2.1, 0.18, x + 2, 1.05, mz - 1.35);
    }
    for (let i = -1; i <= 1; i++) {
      box(0x4b4036, 2.6, 0.5, 0.6, mx + i * 7, 0.25, mz + 8);
      box(0x725d46, 2.6, 0.08, 0.7, mx + i * 7, 0.7, mz + 8);
    }

    // --- Football pitch, goals and simple perimeter ---
    const fx = city.half * 0.35, fz = -city.half * 0.28;
    plane(0x2f824b, 42, 26, fx, fz, 0.04);
    plane(0xe9e1c7, 36, 0.18, fx, fz, 0.055);
    plane(0xe9e1c7, 0.18, 20, fx, fz, 0.055);
    for (const gx of [fx - 19, fx + 19]) {
      for (const side of [-1, 1]) box(0xf4f0df, 0.18, 2.6, 0.18, gx, 1.3, fz + side * 4.2);
      box(0xf4f0df, 0.18, 2.6, 8.4, gx, 1.3, fz);
      box(0xf4f0df, 8.4, 0.18, 0.18, gx, 2.6, fz);
    }
    for (let i = -3; i <= 3; i++) {
      box(0x555b61, 0.12, 1.1, 0.12, fx - 20 + i * 6.5, 0.55, fz - 14);
    }

    // --- Playground: slide, swings and benches ---
    const px = -city.half * 0.28, pz = -city.half * 0.32;
    plane(0xb98a5d, 28, 22, px, pz, 0.035);
    box(0xe66b42, 2, 2.8, 6, px, 1.4, pz);
    for (let i = -1; i <= 1; i++) {
      box(0x4f5a63, 0.16, 3.0, 0.16, px + i * 2.4, 1.5, pz + 5);
      box(0x4f5a63, 0.16, 3.0, 0.16, px + i * 2.4, 1.5, pz + 8);
      box(0x4f5a63, 4.8, 0.16, 0.16, px + i * 2.4, 3, pz + 6.5);
      box(0x3b79a9, 0.18, 1.4, 0.18, px + i * 2.4, 0.7, pz - 5);
    }
    box(0x45413a, 3.2, 0.5, 0.7, px - 7, 0.25, pz + 6);
    box(0x6f5b43, 3.2, 0.08, 0.7, px - 7, 0.7, pz + 6);

    // --- Supermarkets: entrance canopies, parking bays and sign bands ---
    for (const [x, z] of [[city.half * 0.28, city.half * 0.16], [city.half * 0.48, -city.half * 0.08]]) {
      box(0xd9d2c7, 18, 5, 12, x, 2.5, z);
      box(0x1e7bd4, 14, 0.9, 0.18, x, 4.4, z - 6.05);
      box(0xe9e5dd, 10, 0.22, 2.0, x, 4.7, z - 7.0);
      for (let p = -2; p <= 2; p++) {
        box(0x85888c, 0.16, 2.8, 0.16, x + p * 2.1, 1.4, z - 7.0);
        plane(0x6b6f73, 1.5, 5.0, x + p * 2.1, z - 10.0, 0.025);
      }
      for (let p = -2; p <= 2; p++) plane(0xd9d9d5, 1.7, 0.16, x + p * 2.1, z - 8.2, 0.028);
    }
  }

  /**
   * Streamed world: recentre the ground + the shadow/sun window on the player so
   * the lit, shadow-casting region travels with them (the sun is repositioned
   * from these in `setTimeOfDay`, which runs every frame). No-op when finite.
   */
  follow(x: number, z: number): void {
    if (!this.streaming) return;
    this.followX = x;
    this.followZ = z;
    this.ground.position.set(x, 0, z);
  }

  private addRoads(city: City): void {
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x3a404b, roughness: 0.9 });
    const roadGeoH = new THREE.PlaneGeometry(city.extent, city.config.roadWidth);
    const roadGeoV = new THREE.PlaneGeometry(city.config.roadWidth, city.extent);

    for (const c of city.roadCenters) {
      const h = new THREE.Mesh(roadGeoH, asphalt);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, c);
      h.receiveShadow = true;
      this.scene.add(h);

      const v = new THREE.Mesh(roadGeoV, asphalt);
      v.rotation.x = -Math.PI / 2;
      v.position.set(c, 0.02, 0);
      v.receiveShadow = true;
      this.scene.add(v);
    }
  }

  /** Place a small pool of warm non-shadowing lights at the nearest buildings. */
  updateHouseLights(x: number, z: number, buildings: City['buildings']): void {
    const nearest = buildings
      .map((b) => ({ b, d2: (b.cx - x) ** 2 + (b.cz - z) ** 2 }))
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, this.houseLights.length);
    this.houseLights.forEach((light, i) => {
      const item = nearest[i];
      if (!item) { light.intensity = 0; return; }
      const b = item.b;
      light.position.set(b.cx + Math.min(b.width * 0.45, 4), Math.min(Math.max(2.5, b.height * 0.45), 7), b.cz + b.depth * 0.45);
      light.intensity = item.d2 < 22 * 22 ? 7 : 0;
    });
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
