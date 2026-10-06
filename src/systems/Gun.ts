import * as THREE from 'three';

export interface GunState {
  ammo: number;
  reserve: number;
  reloading: boolean;
}

export class Gun {
  private readonly stateData: GunState = { ammo: 30, reserve: 120, reloading: false };
  private cooldown = 0;
  private reloadTimer = 0;
  private readonly tracerMaterial = new THREE.LineBasicMaterial({ color: 0xffe7a1, transparent: true, opacity: 0.9 });
  private tracers: Array<{ line: THREE.Line; ttl: number }> = [];
  private readonly model: THREE.Group;
  private readonly barrelFlash: THREE.Mesh;

  constructor(private readonly scene: THREE.Scene) {
    this.model = new THREE.Group();
    // Compact third-person pistol/rifle silhouette. The model points along -Z,
    // matching Three.js' conventional forward direction.
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x20242a, metalness: 0.7, roughness: 0.28 }),
    );
    body.position.z = -0.25;
    body.castShadow = true;
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.34, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.72 }),
    );
    grip.position.set(0, -0.18, -0.03);
    grip.rotation.x = -0.18;
    grip.castShadow = true;
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8),
      new THREE.MeshStandardMaterial({ color: 0x080a0d, metalness: 0.8, roughness: 0.22 }),
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.68;
    barrel.castShadow = true;
    this.barrelFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd36a }),
    );
    this.barrelFlash.position.z = -0.86;
    this.barrelFlash.visible = false;
    this.model.add(body, grip, barrel, this.barrelFlash);
    this.model.visible = false;
    this.scene.add(this.model);
  }

  state(): GunState {
    return { ...this.stateData };
  }

  setVisible(visible: boolean): void {
    this.model.visible = visible;
    if (!visible) this.barrelFlash.visible = false;
  }

  update(dt: number, fire: boolean, reload: boolean, origin: THREE.Vector3, direction: THREE.Vector3, hit: (dirX: number, dirZ: number) => boolean): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.barrelFlash.visible = false;

    // Visibility is controlled by the active game mode.
    this.model.position.copy(origin);
    // Player heading uses +X at yaw 0 while the gun points -Z.
    this.model.rotation.y = Math.atan2(-direction.x, -direction.z);
    this.model.position.x += direction.x * 0.55;
    this.model.position.y -= 0.10;
    this.model.position.z += direction.z * 0.55;

    if (reload && !this.stateData.reloading && this.stateData.ammo < 30 && this.stateData.reserve > 0) {
      this.stateData.reloading = true;
      this.reloadTimer = 1.25;
    }

    if (this.stateData.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = 30 - this.stateData.ammo;
        const take = Math.min(need, this.stateData.reserve);
        this.stateData.ammo += take;
        this.stateData.reserve -= take;
        this.stateData.reloading = false;
      }
    } else if (fire && this.cooldown <= 0 && this.stateData.ammo > 0) {
      this.stateData.ammo--;
      this.cooldown = 0.095;
      hit(direction.x, direction.z);
      this.addTracer(origin, direction);
      this.barrelFlash.visible = true;
      if (this.stateData.ammo === 0 && this.stateData.reserve > 0) {
        this.stateData.reloading = true;
        this.reloadTimer = 1.25;
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.ttl -= dt;
      const material = t.line.material;
      if (!Array.isArray(material) && 'opacity' in material) {
        material.opacity = Math.max(0, t.ttl / 0.055);
      }
      if (t.ttl <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  private addTracer(origin: THREE.Vector3, direction: THREE.Vector3): void {
    const end = origin.clone().add(direction.clone().multiplyScalar(48));
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geometry, this.tracerMaterial.clone());
    line.renderOrder = 20;
    this.scene.add(line);
    this.tracers.push({ line, ttl: 0.055 });
  }
}
