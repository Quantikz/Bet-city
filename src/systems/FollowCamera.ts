import * as THREE from 'three';
import { damp } from '../core/math';
import { followDistance, lookLead, type FollowParams } from '../core/followCam';

export type { FollowParams };

export const CAR_CAM: FollowParams = { distance: 9, height: 4.2, lookHeight: 1.4, stiffness: 4, speedPull: 0.16, slideSwing: 0.3, maxSwing: 2 };
export const FOOT_CAM: FollowParams = { distance: 5, height: 3, lookHeight: 1.4, stiffness: 7 };

/**
 * Smoothed chase camera. The desired pose sits behind the target along its
 * heading; both the eye and the look-at point are exponentially damped so the
 * camera glides instead of snapping. Damping is frame-rate independent.
 */
export class FollowCamera {
  private readonly look = new THREE.Vector3();
  private orbitYaw = 0;
  private orbitPitch = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /**
   * Heading convention matches the sim: forward = (cos h, 0, -sin h). The eye trails
   * behind the *heading*; the look-at leads along the *velocity vector* `(vx, vz)` so the
   * car stays centred even when travel diverges from heading (powerslides).
   */
  update(x: number, z: number, heading: number, p: FollowParams, dt: number, vx = 0, vz = 0): void {
    const yaw = heading + this.orbitYaw;
    const pitch = Math.max(-0.25, Math.min(1.25, (p.pitch ?? 0.05) + this.orbitPitch));
    const zoom = p.zoom ?? 1;
    const fx = Math.cos(yaw) * Math.cos(pitch);
    const fz = -Math.sin(yaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const speed = Math.hypot(vx, vz);

    // Pull the camera in as speed rises so damping lag doesn't widen the framing.
    const dist = followDistance(p, speed) * zoom;
    const desiredX = x - fx * dist;
    const desiredZ = z - fz * dist;
    const desiredY = p.height + fy * dist;

    this.camera.position.x = damp(this.camera.position.x, desiredX, p.stiffness, dt);
    this.camera.position.y = damp(this.camera.position.y, desiredY, p.stiffness, dt);
    this.camera.position.z = damp(this.camera.position.z, desiredZ, p.stiffness, dt);

    // Decompose velocity into forward (along heading) + lateral (perpendicular). Lead the
    // forward part fully (no climb-at-speed), the lateral part only partially — so the car
    // keeps a small, bounded swing during a powerslide instead of snapping to dead-centre.
    const rx = Math.sin(yaw);
    const rz = Math.cos(yaw);
    const vForward = vx * fx + vz * fz;
    const vLateral = vx * rx + vz * rz;
    const lead = lookLead(p, vForward, vLateral);
    const leadX = fx * lead.forward + rx * lead.lateral;
    const leadZ = fz * lead.forward + rz * lead.lateral;
    this.look.x = damp(this.look.x, x + leadX, p.stiffness, dt);
    this.look.y = damp(this.look.y, p.lookHeight + Math.sin(pitch) * 0.5, p.stiffness, dt);
    this.look.z = damp(this.look.z, z + leadZ, p.stiffness, dt);
    this.camera.lookAt(this.look);
  }

  /** Apply touch/mouse free-look deltas. */
  lookInput(dx: number, dy: number): void {
    this.orbitYaw -= dx * 0.012;
    this.orbitPitch = Math.max(-0.2, Math.min(0.95, this.orbitPitch - dy * 0.008));
  }

  resetOrbit(): void {
    this.orbitYaw = 0;
    this.orbitPitch = 0;
  }

  /** Yaw the camera is currently looking along — used for camera-relative walking. */
  get yaw(): number {
    const dx = this.look.x - this.camera.position.x;
    const dz = this.look.z - this.camera.position.z;
    return Math.atan2(-dz, dx);
  }
}
