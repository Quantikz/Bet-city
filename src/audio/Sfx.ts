/**
 * Clean CC0 game audio from OpenGameArt.
 *
 * Engine loops:
 * https://opengameart.org/content/racing-car-engine-sound-loops
 *
 * Footsteps:
 * https://opengameart.org/content/footsteps-0
 *
 * The samples are real recordings/loops. Playback rate and gain are driven
 * continuously by the game's actual speed instead of swapping synthetic tones.
 */

const STEP_URLS = [
  'https://opengameart.org/sites/default/files/01-footstep_0.ogg',
  'https://opengameart.org/sites/default/files/02-footstep_0.ogg',
  'https://opengameart.org/sites/default/files/03-footstep_0.ogg',
  'https://opengameart.org/sites/default/files/04-footstep_0.ogg',
  'https://opengameart.org/sites/default/files/05-footstep_0.ogg',
  'https://opengameart.org/sites/default/files/06-footstep_0.ogg',
] as const;

const ENGINE_URLS = [
  'https://opengameart.org/sites/default/files/loop_0.wav',
  'https://opengameart.org/sites/default/files/loop_1.wav',
  'https://opengameart.org/sites/default/files/loop_2.wav',
  'https://opengameart.org/sites/default/files/loop_3.wav',
  'https://opengameart.org/sites/default/files/loop_4.wav',
  'https://opengameart.org/sites/default/files/loop_5.wav',
] as const;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export class Sfx {
  private readonly engine = new Audio();
  private readonly steps = STEP_URLS.map((src) => {
    const a = new Audio(src);
    a.preload = 'auto';
    a.volume = 0;
    a.playbackRate = 1;
    return a;
  });
  private started = false;
  private masterVolume = 0.8;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.engine.src = ENGINE_URLS[0];
    this.engine.loop = true;
    this.engine.preload = 'auto';
    this.engine.volume = 0;
    this.engine.playbackRate = 0.9;
    this.engine.load();
  }

  setMasterVolume(v: number): void {
    this.masterVolume = clamp01(v);
    if (!this.engine.paused) this.engine.volume = this.masterVolume * 0.068;
  }

  /**
   * A step is emitted by actual travelled distance in main.ts. Speed changes
   * the sample rate slightly so walking, sprinting and crouching do not sound
   * like the same cadence.
   */
  footstep(speed: number, maxSpeed = 8): void {
    if (!this.started) return;
    const normalized = clamp01(speed / Math.max(0.1, maxSpeed));
    const a = this.steps[Math.floor(Math.random() * this.steps.length)];
    a.currentTime = 0;
    a.playbackRate = 0.92 + normalized * 0.18;
    a.volume = this.masterVolume * (0.048 + normalized * 0.024);
    void a.play().catch(() => {});
  }

  /**
   * The CC0 engine pack consists of the same engine at different pitches.
   * We stay on one loop and continuously change playback rate instead of
   * jumping between files, which makes throttle/speed transitions seamless.
   */
  setEngine(speed01: number, volume: number): void {
    if (!this.started) return;
    const s = clamp01(speed01);
    const v = clamp01(volume);

    // Low-speed idle remains audible; RPM rises non-linearly with road speed.
    const rpm = Math.pow(s, 0.72);
    this.engine.playbackRate = 0.88 + rpm * 0.48;
    this.engine.volume = this.masterVolume * (0.032 + v * 0.060);

    if (this.engine.paused && v > 0.01) {
      void this.engine.play().catch(() => {});
    } else if (!this.engine.paused && v <= 0.001) {
      this.engine.pause();
    }
  }

  // Tire squeal is currently intentionally silent; the old synthesized noise
  // sounded artificial. It will be enabled with a dedicated recorded sample.
  setScreech(_amount01: number): void {}

  // Keep these APIs for the existing gameplay hooks without reintroducing
  // synthetic beeps/noise.
  gib(): void {}
  explosion(): void {}
  enterCar(): void {}
  exitCar(): void {}
}
