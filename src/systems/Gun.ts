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

  constructor(private readonly scene: THREE.Scene) {}

  state(): GunState {
    return { ...this.stateData };
  }

  update(dt: number, fire: boolean, reload: boolean, origin: THREE.Vector3, direction: THREE.Vector3, hit: (dirX: number, dirZ: number) => boolean): void {
    this.cooldown = Math.max(0, this.cooldown - dt);

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
