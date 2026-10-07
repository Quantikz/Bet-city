import { angleDelta, clamp } from '../core/math';

const WALK = 4.2;
const RUN = 8;
const TURN_WALK = 4.2;
const TURN_RUN = 5.8;
const TURN_CROUCH = 3.2;
const JUMP_SPEED = 6.2;
const GRAVITY = 18;

/**
 * On-foot avatar. Movement is camera-relative (the caller supplies a desired
 * world direction); the avatar accelerates toward it and yaws to face travel.
 * Collision is resolved by the caller against the shared building colliders.
 */
export class Player {
  x = 0;
  z = 0;
  heading = 0;
  speed = 0;
  y = 0;
  vy = 0;
  crouched = false;
  px = 0;
  pz = 0;
  ph = 0;
  py = 0;

  savePrev(): void {
    this.px = this.x;
    this.pz = this.z;
    this.ph = this.heading;
    this.py = this.y;
  }

  /** dirX/dirZ: desired world-space move direction (need not be normalized). */
  update(dirX: number, dirZ: number, running: boolean, dt: number): void {
    const mag = Math.hypot(dirX, dirZ);
    const maxSpeed = this.crouched ? WALK * 0.55 : (running ? RUN : WALK);

    const input = Math.min(1, mag);
    const targetSpeed = input * maxSpeed;
    const response = targetSpeed > this.speed ? 10 : 14;
    this.speed += (targetSpeed - this.speed) * Math.min(1, response * dt);

    if (mag > 0.12 && this.speed > 0.08) {
      const nx = dirX / mag;
      const nz = dirZ / mag;
      this.x += nx * this.speed * dt;
      this.z += nz * this.speed * dt;

      const target = Math.atan2(-nz, nx);
      const turnRate = this.crouched
        ? TURN_CROUCH
        : (running ? TURN_RUN : TURN_WALK);
      this.heading += clamp(angleDelta(this.heading, target), -turnRate * dt, turnRate * dt);
    }

    if (this.speed < 0.02) this.speed = 0;

    if (this.y > 0 || this.vy > 0) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
  }

  jump(): boolean {
    if (this.y > 0.02) return false;
    this.vy = JUMP_SPEED;
    return true;
  }

  setCrouched(on: boolean): void { this.crouched = on; }
}
