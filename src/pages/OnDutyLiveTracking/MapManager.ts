import L from 'leaflet';

export class MapManager {
  /**
   * Initializes Leaflet Map instance with full touch & mouse gesture support.
   */
  public static createMap(
    element: HTMLElement,
    center: [number, number],
    zoom: number
  ): L.Map {
    const map = L.map(element, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      bounceAtZoomLimits: false,
      tap: false, // Prevents touch interactions from being hijacked by Ionic container
    } as any);

    return map;
  }

  /**
   * Returns tile layer configuration based on style selection.
   */
  public static getTileLayer(style: 'streets' | 'voyager' | 'satellite'): L.TileLayer {
    switch (style) {
      case 'voyager':
        return L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 20,
        });
      case 'satellite':
        return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
        });
      case 'streets':
      default:
        return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        });
    }
  }
}
