/**
 * Local background music player.
 *
 * Commercial tracks are intentionally not bundled or fetched from unofficial
 * sources. Put music you own or are licensed to use in /public/music.
 */
export class Music {
  private readonly audio = new Audio();
  private index = 0;
  private started = false;
  private readonly tracks = [
    { title: 'Rema - Calm Down', file: '/music/rema-calm-down.mp3' },
    { title: 'Rema - Soundgasm', file: '/music/rema-soundgasm.mp3' },
    { title: 'Rema - Charm', file: '/music/rema-charm.mp3' },
    { title: 'Rema - Baby (Is It A Crime)', file: '/music/rema-baby-is-it-a-crime.mp3' },
    { title: 'Rema - Dumebi', file: '/music/rema-dumebi.mp3' },
  ];

  constructor() {
    this.audio.preload = 'metadata';
    this.audio.loop = false;
    this.audio.volume = 0.16;
    this.audio.addEventListener('ended', () => this.next());
  }

  start(): void {
    if (this.started || this.tracks.length === 0) return;
    this.started = true;
    this.loadCurrent();
    void this.audio.play().catch(() => {
      this.started = false;
    });
  }

  setDriving(driving: boolean): void {
    // Keep music quieter while driving so engine/road audio remains audible.
    this.audio.volume = driving ? 0.20 : 0.16;
  }

  resume(): void {
    if (!this.audio.paused) return;
    if (!this.started) {
      this.start();
      return;
    }
    void this.audio.play().catch(() => {});
  }

  private next(): void {
    this.index = (this.index + 1) % this.tracks.length;
    this.loadCurrent();
    void this.audio.play().catch(() => {
      this.started = false;
    });
  }

  private loadCurrent(): void {
    const track = this.tracks[this.index];
    if (!track) return;
    this.audio.src = track.file;
    this.audio.load();
  }
}
