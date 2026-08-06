import L from 'leaflet';

export class AnimationEngine {
  private static animFrames: { [key: string]: number } = {};

  /**
   * Smoothly interpolates Leaflet marker position & orientation from start to end over duration (ms)
   * Prevents animation conflicts by cancelling any ongoing animation frame for the given empKey.
   */
  public static animateMarker(
    empKey: string,
    marker: L.Marker,
    startPos: L.LatLng,
    endPos: L.LatLng,
    startHeading: number = 0,
    endHeading: number = 0,
    duration: number = 1800,
    onStep?: (currentPos: [number, number]) => void
  ): void {
    // Cancel existing animation for this employee marker if active
    if (this.animFrames[empKey]) {
      cancelAnimationFrame(this.animFrames[empKey]);
      delete this.animFrames[empKey];
    }

    const startTime = performance.now();

    // Calculate shortest angular distance for rotation (-180 to 180)
    let deltaHeading = (endHeading - startHeading) % 360;
    if (deltaHeading > 180) deltaHeading -= 360;
    if (deltaHeading < -180) deltaHeading += 360;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic easing easeOutCubic: 1 - Math.pow(1 - progress, 3)
      const eased = 1 - Math.pow(1 - progress, 3);

      const lat = startPos.lat + (endPos.lat - startPos.lat) * eased;
      const lng = startPos.lng + (endPos.lng - startPos.lng) * eased;
      const currentHeading = startHeading + deltaHeading * eased;

      marker.setLatLng([lat, lng]);

      // Update marker element rotation arrow if present
      const markerElement = marker.getElement();
      if (markerElement) {
        const arrow = markerElement.querySelector('.marker-arrow-indicator') as HTMLElement;
        if (arrow) {
          arrow.style.transform = `rotate(${currentHeading}deg)`;
        }
      }

      if (onStep) {
        onStep([lat, lng]);
      }

      if (progress < 1) {
        this.animFrames[empKey] = requestAnimationFrame(animate);
      } else {
        marker.setLatLng(endPos);
        delete this.animFrames[empKey];
      }
    };

    this.animFrames[empKey] = requestAnimationFrame(animate);
  }

  /**
   * Smoothly pans map to lat/lng with bottom-sheet padding offset so marker sits cleanly in viewport
   */
  public static panToWithOffset(
    map: L.Map,
    lat: number,
    lng: number,
    zoom: number = 16,
    offsetYPixels: number = 120
  ): void {
    const targetLatLng = L.latLng(lat, lng);
    const containerPoint = map.latLngToContainerPoint(targetLatLng);
    const adjustedPoint = L.point(containerPoint.x, containerPoint.y + offsetYPixels);
    const adjustedLatLng = map.containerPointToLatLng(adjustedPoint);

    map.flyTo(adjustedLatLng, zoom, {
      animate: true,
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }

  /**
   * Cancel all pending marker animations
   */
  public static stopAll(): void {
    Object.keys(this.animFrames).forEach((key) => {
      cancelAnimationFrame(this.animFrames[key]);
    });
    this.animFrames = {};
  }
}
