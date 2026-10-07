/**
 * Clean external game audio sourced from OpenGameArt CC0 assets.
 *
 * Footsteps:
 * https://opengameart.org/content/footsteps-0
 * Engine:
 * https://opengameart.org/content/racing-car-engine-sound-loops
 *
 * These are deliberately kept as small HTMLAudio elements instead of being
 * synthesized with oscillators/noise. That removes the artificial "beep/drone"
 * character of the old beta audio and keeps the game bundle small.
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

export class Sfx {
  private readonly engine = new Audio();
  private readonly steps = STEP_URLS.map((src) => {
    const a = new Audio(src);
    a.preload = 'auto';
    a.volume = 0;
    return a;
  });
  private started = false;
  private masterVolume = 0.8;

  start(): void {
    if (this.started) {
      void this.engine.play().catch(() => {});
      return;
    }

    this.started = true;
    this.engine.src = ENGINE_URLS[1];
    this.engine.loop = true;
    this.engine.preload = 'auto';
    this.engine.volume = 0;
    // Load on the first gesture, but remain silent until driving.
    this.engine.load();
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    this.engine.volume = this.masterVolume * 0.42;
  }

  /**
   * Uses real recorded CC0 footsteps rather than synthesized noise.
   * Random selection prevents the repeated-machine-gun step pattern.
   */
  footstep(): void {
    if (!this.started) return;
    const a = this.steps[Math.floor(Math.random() * this.steps.length)];
    a.currentTime = 0;
    a.volume = this.masterVolume * 0.48;
    void a.play().catch(() => {});
  }

  /**
   * Uses one of the real CC0 engine loops and changes playback rate for
   * believable acceleration without generating an artificial oscillator.
   */
  setEngine(speed01: number, volume: number): void {
    if (!this.started) return;
    const s = Math.max(0, Math.min(1, speed01));
    const index = Math.min(ENGINE_URLS.length - 1, Math.floor(s * ENGINE_URLS.length));
    const src = ENGINE_URLS[index];

    if (this.engine.src !== src) {
      const wasPlaying = !this.engine.paused;
      this.engine.src = src;
      this.engine.load();
      if (wasPlaying) void this.engine.play().catch(() => {});
    }

    this.engine.playbackRate = 0.92 + s * 0.22;
    this.engine.volume = Math.max(0, Math.min(1, volume)) * this.masterVolume * 0.42;

    if (volume > 0.001 && this.engine.paused) {
      void this.engine.play().catch(() => {});
    } else if (volume <= 0.001 && !this.engine.paused) {
      this.engine.pause();
    }
  }

  // The old synthesized tyre screech was intentionally removed. Keep the
  // method for the existing vehicle update API without producing noise.
  setScreech(_amount01: number): void {}

  // These placeholder effects are intentionally silent until a matching clean
  // CC0 sample is added; no synthetic beeps/noise remain in the beta.
  gib(): void {}
  explosion(): void {}
  enterCar(): void {}
  exitCar(): void {}
}
