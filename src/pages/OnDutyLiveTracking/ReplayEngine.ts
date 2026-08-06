import L from 'leaflet';

export class ReplayEngine {
  private timerId: any = null;
  private pathPoints: L.LatLng[] = [];
  private speed = 1; // speed multiplier (1x, 2x, 5x, etc.)
  private currentIndex = 0;
  private onTick: (pos: L.LatLng, index: number) => void;
  private onFinished: () => void;

  constructor(
    points: L.LatLng[],
    onTick: (pos: L.LatLng, index: number) => void,
    onFinished: () => void
  ) {
    this.pathPoints = points;
    this.onTick = onTick;
    this.onFinished = onFinished;
  }

  public setSpeed(multiplier: number): void {
    this.speed = multiplier;
    if (this.timerId) {
      this.pause();
      this.play();
    }
  }

  public setPosition(index: number): void {
    if (index >= 0 && index < this.pathPoints.length) {
      this.currentIndex = index;
      this.onTick(this.pathPoints[index], index);
    }
  }

  public play(): void {
    if (this.timerId || this.pathPoints.length === 0) return;

    const baseInterval = 1000; // 1 second interval per coordinate ping
    const interval = baseInterval / this.speed;

    this.timerId = setInterval(() => {
      if (this.currentIndex >= this.pathPoints.length - 1) {
        this.pause();
        this.onFinished();
        return;
      }

      this.currentIndex++;
      this.onTick(this.pathPoints[this.currentIndex], this.currentIndex);
    }, interval);
  }

  public pause(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public isPlaying(): boolean {
    return this.timerId !== null;
  }

  public stop(): void {
    this.pause();
    this.currentIndex = 0;
  }
}
