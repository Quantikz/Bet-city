import * as THREE from 'three';
import { daylightFactor, sunPosition } from '../core/math';
import { makeGlowTexture } from './textures';
import { landmarkLocations, type City } from '../world/City';

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
  private readonly footballPlayers: { group: THREE.Group; phase: number; lane: number; speed: number }[] = [];
  private footballBall: THREE.Mesh | null = null;

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
    this.addCompactCityLandmarks(city);
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
    return; // Westminster dressing is generated by addWestminsterLandmarks.
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
    const loc = landmarkLocations(city);
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
    const mx = loc.market.x, mz = loc.market.z;
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
    const fx = loc.football.x, fz = loc.football.z;
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
    const px = loc.playground.x, pz = loc.playground.z;
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

    // --- Supermarkets: real shell + entrance + interior aisles ---
    for (const { x, z } of loc.supermarkets) {
      const wall = mat(0xd9d2c7, 0.72);
      const inner = mat(0xf0ede5, 0.9);
      // Floor is deliberately visible through the open entrance.
      plane(0xe6e1d6, 17.2, 11.2, x, z, 0.045);
      box(0xd9d2c7, 18, 5, 0.45, x, 2.5, z - 5.78);
      box(0xd9d2c7, 0.45, 5, 12, x - 8.78, 2.5, z);
      box(0xd9d2c7, 0.45, 5, 12, x + 8.78, 2.5, z);
      const doorW = 3.8;
      const sideW = (18 - doorW) / 2;
      box(0xd9d2c7, sideW, 5, 0.45, x - (doorW / 2 + sideW / 2), 2.5, z + 5.78);
      box(0xd9d2c7, sideW, 5, 0.45, x + (doorW / 2 + sideW / 2), 2.5, z + 5.78);
      // Bright interior ceiling beam and entrance canopy.
      box(0xffffff, 17.2, 0.18, 0.45, x, 4.8, z);
      box(0x1e7bd4, 14, 0.9, 0.18, x, 4.4, z + 6.05);
      box(0xe9e5dd, 10, 0.22, 2.0, x, 4.7, z + 7.0);
      // Four shelf islands correspond exactly to the collision map in City.ts.
      for (const sx of [-5.0, -1.7, 1.7, 5.0]) {
        box(0x7a5b3f, 0.85, 1.2, 5.0, x + sx, 0.6, z - 1.0);
        box(0xc7b18f, 0.95, 0.08, 5.2, x + sx, 1.25, z - 1.0);
      }
      box(0x4d5660, 8.0, 1.0, 0.8, x, 0.5, z + 4.0);
      // Entrance doors are glass panels placed beside the walkable centre.
      const glass = new THREE.MeshPhysicalMaterial({ color: 0x8bd8ef, transparent: true, opacity: 0.28, roughness: 0.08, transmission: 0.35 });
      box(0x85888c, 0.16, 2.8, 0.16, x - doorW / 2, 1.4, z + 6.0);
      box(0x85888c, 0.16, 2.8, 0.16, x + doorW / 2, 1.4, z + 6.0);
      const door = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.46, 2.8, 0.05), glass);
      door.position.set(x - doorW * 0.23, 1.4, z + 6.0);
      this.scene.add(door);
      const door2 = door.clone();
      door2.position.x = x + doorW * 0.23;
      this.scene.add(door2);
      // Parking bays remain outside the entrance.
      for (let p = -2; p <= 2; p++) {
        plane(0x6b6f73, 1.5, 5.0, x + p * 2.1, z + 10.0, 0.025);
        plane(0xd9d9d5, 1.7, 0.16, x + p * 2.1, z + 8.2, 0.028);
      }
      void wall; void inner;
    }

    // --- Living football match: lightweight animated players + ball ---
    const playerMatColors = [0xe84b3c, 0xf2f0e6, 0x2d72c7, 0xf0c54a];
    const makeFootballer = (color: number): THREE.Group => {
      const g = new THREE.Group();
      const shirt = mat(color, 0.8);
      const skin = mat(0x7a4b32, 0.78);
      const pants = mat(0x202733, 0.9);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 8), shirt);
      body.position.y = 1.0; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skin);
      head.position.y = 1.55; g.add(head);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.34, 3, 6), pants);
        leg.position.set(side * 0.1, 0.52, 0); g.add(leg);
      }
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      return g;
    };
    for (let i = 0; i < 10; i++) {
      const g = makeFootballer(playerMatColors[i % playerMatColors.length]);
      const phase = i * 0.71;
      const lane = (i % 5 - 2) * 3.5;
      g.position.set(fx + Math.sin(phase) * 12, 0, fz + lane);
      this.scene.add(g);
      this.footballPlayers.push({ group: g, phase, lane, speed: 0.55 + (i % 3) * 0.16 });
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), mat(0xf5f5f2, 0.5));
    ball.position.set(fx, 0.22, fz);
    ball.castShadow = true;
    this.scene.add(ball);
    this.footballBall = ball;
  }

  private addCompactCityLandmarks(city: City): void {
    const mat = (color:number, roughness=0.85) =>
      new THREE.MeshStandardMaterial({color, roughness});

    const plane = (color:number,w:number,d:number,x:number,z:number,y=0.02) => {
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat(color));
      m.rotation.x=-Math.PI/2; m.position.set(x,y,z); m.receiveShadow=true; this.scene.add(m); return m;
    };
    const box = (color:number,w:number,h:number,d:number,x:number,y:number,z:number) => {
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));
      m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; this.scene.add(m); return m;
    };

    // Open green ground: roads are drawn separately, so the city does not look like
    // one giant sheet of asphalt.
    plane(0x718064, city.extent*2, city.extent*2, 0, 0, -0.01);

    // Sea and a simple protected shoreline on the south side.
    plane(0x2e7187, city.extent*1.65, 105, 0, -235, -0.005);
    box(0x9b9a86, city.extent*1.65, 0.18, 3, 0, 0.09, -182);

    // Two proper football pitches.
    for(const [x,z] of [[-175,95],[175,145]]){
      plane(0x3f7d43, 116, 72, x, z, 0.025);
      const lineMat=mat(0xe8e8d8);
      const line=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(112,68)),new THREE.LineBasicMaterial({color:0xe8e8d8}));
      line.rotation.x=-Math.PI/2; line.position.set(x,0.08,z); this.scene.add(line);
      box(0x6d4c36,1.2,2.5,1.2,x-54,1.25,z);
      box(0x6d4c36,1.2,2.5,1.2,x+54,1.25,z);
    }

    // Mosque: dome + small minaret.
    const dome=new THREE.Mesh(new THREE.SphereGeometry(12,20,12,0,Math.PI*2,0,Math.PI/2),mat(0xd8d1c1));
    dome.scale.y=0.7; dome.position.set(-70,9,205); dome.castShadow=true; this.scene.add(dome);
    const minaret=box(0xc7c0b0,3.2,18,3.2,-58,9,205);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(2.5,5,12),mat(0xc7c0b0)); cap.position.set(-58,20.5,205); this.scene.add(cap);

    // Church: simple tower and pitched roof silhouette.
    box(0xc0b9ae,38,10,30,70,5,205);
    box(0xa69b8d,8,22,8,82,11,205);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(23,12,4),mat(0x746b61));
    roof.rotation.y=Math.PI/4; roof.position.set(70,11,205); roof.castShadow=true; this.scene.add(roof);

    // Train line, sleepers and a short passenger train near the station.
    const railMat=new THREE.MeshStandardMaterial({color:0x46484b,metalness:0.7,roughness:0.5});
    for(const x of [-32,32]){
      const rail=box(0x4b4d50,1.1,0.18,220,x,0.12,120); rail.material=railMat;
      for(let z=18;z<225;z+=9) box(0x6b5a49,70,0.12,1.2,0,0.06,z);
    }
    box(0x5c6d77,20,4.5,58,0,2.25,120);
    for(const x of [-5,5,15]){
      box(0xb7b9bd,8,3.2,16,x,3.8,120);
    }

    // Three small storefront signs/awnings make the shops readable.
    for(const [x,z] of [[-185,-35],[-150,-35],[155,-35]]){
      box(0x3e5564,18,1.8,1.2,x,5.2,z-9);
      box(0xd2b36a,20,0.45,1.8,x,3.2,z-9);
    }

    // Boats in the sea.
    for(const [x,z,scale] of [[-120,-215,1],[-5,-225,0.8],[115,-210,1.15]]){
      const hull=box(0x4b3f36,10*scale,2.2*scale,4*scale,x,1.1,z);
      hull.rotation.y=0.12;
      const mast=box(0xe2ddd0,0.35,8*scale,0.35,x,5*scale,z);
      const sail=new THREE.Mesh(new THREE.ConeGeometry(4*scale,7*scale,3),mat(0xe5dfd0));
      sail.rotation.z=Math.PI/2; sail.position.set(x+2*scale,5*scale,z); this.scene.add(sail);
    }

    // Small hospital/police visual cues on the existing buildings.
    box(0xf4f4ee,18,4,0.8,-190,12,14);
    box(0xc84646,3,0.5,1,-190,12.3,13.5);
    box(0xf4f4ee,16,3.5,0.8,190,12,25);
    box(0x3564a8,2.5,0.45,1,190,13,24.5);
  }

  /** Advance the ambient football match without adding a full NPC simulation cost. */
  updateActivities(dt: number, time: number): void {
    if (this.footballPlayers.length === 0) return;
    for (let i = 0; i < this.footballPlayers.length; i++) {
      const p = this.footballPlayers[i];
      const t = time * p.speed + p.phase;
      p.group.position.x += (Math.cos(t) * 0.9) * dt;
      p.group.position.z = this.footballPlayers[i].group.position.z + Math.sin(t * 1.7) * 0.02;
      p.group.rotation.y = Math.sin(t) * 0.7;
      const stride = Math.sin(t * 7) * 0.16;
      p.group.children[2]?.rotation.set(stride, 0, 0);
      p.group.children[3]?.rotation.set(-stride, 0, 0);
    }
    if (this.footballBall) {
      this.footballBall.position.x += Math.cos(time * 1.8) * 0.018;
      this.footballBall.position.z += Math.sin(time * 2.1) * 0.02;
      this.footballBall.position.y = 0.22 + Math.abs(Math.sin(time * 3.2)) * 0.18;
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
    const asphalt=new THREE.MeshStandardMaterial({color:0x303238,roughness:0.93});
    const curb=new THREE.MeshStandardMaterial({color:0x9b9b95,roughness:0.9});
    for(const r of city.roadSegments){
      const dx=r.x2-r.x1,dz=r.z2-r.z1,len=Math.hypot(dx,dz),ang=Math.atan2(dz,dx);
      const road=new THREE.Mesh(new THREE.PlaneGeometry(len,r.width),asphalt);
      road.rotation.x=-Math.PI/2;road.rotation.z=ang;
      road.position.set((r.x1+r.x2)/2,0.018,(r.z1+r.z2)/2);
      road.receiveShadow=true;this.scene.add(road);
      for(const side of [-1,1]){
        const c=new THREE.Mesh(new THREE.PlaneGeometry(len,0.55),curb);
        c.rotation.x=-Math.PI/2;c.rotation.z=ang;
        c.position.set((r.x1+r.x2)/2,0.025,(r.z1+r.z2)/2+side*r.width/2);
        this.scene.add(c);

        const sidewalk=new THREE.Mesh(
          new THREE.PlaneGeometry(len,2.2),
          new THREE.MeshStandardMaterial({color:0xb7b2aa,roughness:1}),
        );
        sidewalk.rotation.x=-Math.PI/2;sidewalk.rotation.z=ang;
        sidewalk.position.set(
          (r.x1+r.x2)/2,
          0.012,
          (r.z1+r.z2)/2+side*(r.width/2+1.35),
        );
        sidewalk.receiveShadow=true;
        this.scene.add(sidewalk);
      }
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
