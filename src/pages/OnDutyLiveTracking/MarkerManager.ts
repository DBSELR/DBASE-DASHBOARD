import L from 'leaflet';

export class MarkerManager {
  /**
   * Helper to create vehicle marker div icon layout
   */
  public static createVehicleIcon(
    emp: any,
    isSelected: boolean
  ): L.DivIcon {
    const isMoving = emp.MovementStatus === 'Moving';
    const isOffline = emp.MovementStatus === 'Offline';
    const pulseColor = isMoving ? '#10b981' : isOffline ? '#ef4444' : '#f59e0b';
    const vehicleIcon = emp.TransportMode === 'Bike' ? '🏍️' : '🚗';
    const initial = (emp.EmpName || emp.EmpCode || 'E').charAt(0);
    const empName = emp.EmpName || 'Officer';
    const heading = emp.Heading || 0;

    const markerHtml = `
      <div class="rapido-live-marker ${isSelected ? 'selected' : ''}">
        <div class="marker-pulse-ring" style="border-color: ${pulseColor};"></div>
        <div class="marker-photo-box" style="background: ${pulseColor};">
          ${
            emp.Image
              ? `<img src="${emp.Image}" class="marker-img" alt="${empName}" />`
              : `<span class="marker-initial">${initial}</span>`
          }
        </div>
        <div class="marker-vehicle-badge">${vehicleIcon}</div>
        <div class="marker-arrow-indicator" style="transform: rotate(${heading}deg);">
          ▲
        </div>
      </div>
    `;

    return L.divIcon({
      html: markerHtml,
      className: 'rapido-live-marker-wrapper',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }
}
