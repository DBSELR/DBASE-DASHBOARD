import L from 'leaflet';

export class AnimationEngine {
  /**
   * Smoothly interpolates Leaflet marker position from start to end over duration (ms)
   */
  public static interpolateMarker(
    marker: L.Marker,
    startPos: L.LatLng,
    endPos: L.LatLng,
    duration: number = 2000
  ): void {
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress * (2 - progress); // easeOutQuad

      const lat = startPos.lat + (endPos.lat - startPos.lat) * eased;
      const lng = startPos.lng + (endPos.lng - startPos.lng) * eased;

      marker.setLatLng([lat, lng]);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        marker.setLatLng(endPos);
      }
    };

    requestAnimationFrame(animate);
  }
}
