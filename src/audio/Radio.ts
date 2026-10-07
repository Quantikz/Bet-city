import { RadioModel, type RadioStation } from './RadioModel';

const HEAR_RADIUS = 30;
const LIVE_STREAM_PREFIX = 'https://play.streamafrica.net/';

/** Car radio supporting both finite tracks and live internet radio streams. */
export class Radio {
  private readonly model: RadioModel;
  private readonly audio = new Audio();
  private readonly carStations = new Map<number, number>();
  private loadedCarId: number | null = null;
  private errorStreak = 0;
  private masterVolume = 0.8;

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    this.applyVolume(1);
  }

  constructor(stations: RadioStation[]) {
    this.model = new RadioModel(stations);
    this.audio.preload = 'none';
    this.audio.addEventListener('playing', () => (this.errorStreak = 0));
    this.audio.addEventListener('ended', () => {
      if (this.isLive()) return;
      this.model.nextTrack();
      this.playCurrent(false);
    });
    this.audio.addEventListener('error', () => {
      if (++this.errorStreak > 2) {
        this.audio.pause();
        return;
      }
      this.model.nextTrack();
      this.playCurrent(false);
    });
  }

  enterCar(carId: number): void {
    if (carId === this.loadedCarId) {
      this.applyVolume(1);
      void this.audio.play().catch(() => {});
      return;
    }
    let station = this.carStations.get(carId);
    if (station === undefined) {
      station = Math.floor(Math.random() * this.model.stations.length);
      this.carStations.set(carId, station);
    }
    this.loadedCarId = carId;
    this.model.tuneTo(station);
    this.playCurrent(true);
  }

  step(dir: number): void {
    this.model.cycleStation(dir);
    if (this.loadedCarId !== null) this.carStations.set(this.loadedCarId, this.model.stationIndex);
    this.playCurrent(true);
  }

  updateProximity(inCar: boolean, distance: number): void {
    if (this.loadedCarId === null) return;
    const proximity = inCar ? 1 : Math.max(0, 1 - distance / HEAR_RADIUS) * 0.5;
    this.applyVolume(proximity);
    if (proximity <= 0.001) {
      if (!this.audio.paused) this.audio.pause();
    } else if (this.audio.paused && this.model.current()) {
      void this.audio.play().catch(() => {});
    }
  }

  private applyVolume(proximity: number): void {
    this.audio.volume = Math.max(0, Math.min(1, proximity * this.masterVolume * 0.78));
  }

  private isLive(): boolean {
    return this.model.current()?.track.url.startsWith(LIVE_STREAM_PREFIX) ?? false;
  }

  private playCurrent(seekMiddle: boolean): void {
    const c = this.model.current();
    if (!c) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      return;
    }
    this.audio.pause();
    this.audio.src = c.track.url;
    this.audio.load();
    this.applyVolume(1);
    if (this.isLive()) {
      void this.audio.play().catch(() => {});
      return;
    }
    if (seekMiddle) {
      const onMeta = (): void => {
        this.audio.removeEventListener('loadedmetadata', onMeta);
        if (isFinite(this.audio.duration) && this.audio.duration > 20) {
          this.audio.currentTime = this.audio.duration * (0.05 + Math.random() * 0.5);
        }
        void this.audio.play().catch(() => {});
      };
      this.audio.addEventListener('loadedmetadata', onMeta);
    } else {
      void this.audio.play().catch(() => {});
    }
  }

  label(): string {
    const c = this.model.current();
    return c ? '📻 ' + c.station + ' — ' + c.track.title : '📻 OFF';
  }
}
