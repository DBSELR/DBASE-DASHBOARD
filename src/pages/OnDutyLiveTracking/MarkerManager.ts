import L from 'leaflet';

export class MarkerManager {
  /**
   * Swiggy/Zomato-grade Vehicle Marker DivIcon
   */
  public static createVehicleIcon(
    emp: any,
    isSelected: boolean
  ): L.DivIcon {
    const status = emp.MovementStatus || 'Stationary';
    const isMoving = status === 'Moving';
    const isStationary = status === 'Stationary' || status === 'Idle';
    const isLastKnown = status === 'LastKnown' || status === 'Offline';
    const isPending = status === 'PendingSync';

    // Status colors
    const pulseColor = isMoving
      ? '#10b981'
      : isStationary
      ? '#f59e0b'
      : isLastKnown
      ? '#6366f1'
      : '#94a3b8';

    // Transport Mode vehicle icons
    const mode = (emp.TransportMode || '').toLowerCase();
    const vehicleIcon = mode.includes('bike') || mode.includes('two')
      ? '🏍️'
      : mode.includes('scooter')
      ? '🛵'
      : mode.includes('car') || mode.includes('cab')
      ? '🚗'
      : mode.includes('van') || mode.includes('bus')
      ? '🚐'
      : mode.includes('walk') || mode.includes('foot')
      ? '🚶'
      : '🚘';

    const empName = emp.EmpName || emp.EmpCode || 'Officer';
    const initial = empName.charAt(0).toUpperCase();
    const heading = Math.round(emp.Heading || 0);
    const speed = Math.round(emp.Speed || 0);

    // Format last updated badge text for marker
    const secAgo = typeof emp.SecondsSinceLastUpdate === 'number' ? emp.SecondsSinceLastUpdate : 0;
    const timeLabel = isMoving
      ? `${speed} km/h`
      : isStationary
      ? 'On Site'
      : isLastKnown
      ? secAgo > 3600
        ? `${Math.round(secAgo / 3600)}h ago`
        : `${Math.round(secAgo / 60)}m ago`
      : 'Sync Pending';

    const markerHtml = `
      <div class="swiggy-live-marker ${isSelected ? 'selected' : ''} ${status.toLowerCase()}">
        <div class="marker-speed-tag" style="background: ${pulseColor};">
          <span>${timeLabel}</span>
        </div>
        <div class="marker-pulse-ring" style="border-color: ${pulseColor};"></div>
        <div class="marker-photo-box" style="border-color: ${pulseColor};">
          ${
            emp.Image
              ? `<img src="${emp.Image}" class="marker-img" alt="${empName}" />`
              : `<span class="marker-initial">${initial}</span>`
          }
        </div>
        <div class="marker-vehicle-badge">${vehicleIcon}</div>
        <div class="marker-arrow-indicator" style="transform: rotate(${heading}deg); color: ${pulseColor};">
          ▲
        </div>
      </div>
    `;

    return L.divIcon({
      html: markerHtml,
      className: 'swiggy-live-marker-wrapper',
      iconSize: [52, 60],
      iconAnchor: [26, 50],
      popupAnchor: [0, -52],
    });
  }
}
