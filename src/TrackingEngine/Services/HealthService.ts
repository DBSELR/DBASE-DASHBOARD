import axios from 'axios';
import { API_BASE } from '../../config';
import { BatteryService } from './BatteryService';
import { OfflineQueue } from '../Storage/OfflineQueue';
import { PermissionService } from './PermissionService';

export class HealthService {
  private static timerId: any = null;

  public static startHeartbeat(empCode: string, intervalMs: number = 180000): void {
    if (this.timerId) return;

    this.sendHeartbeat(empCode); // immediate first ping
    this.timerId = setInterval(() => {
      this.sendHeartbeat(empCode);
    }, intervalMs);
  }

  public static stopHeartbeat(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public static async sendHeartbeat(empCode: string): Promise<void> {
    try {
      const battery = await BatteryService.getBatteryState();
      const queueSize = await OfflineQueue.getQueueSize();
      const gpsPermission = await PermissionService.checkGPSPermissions();
      const detailedPermission = await PermissionService.getDetailedPermissionStatus();
      const internet = navigator.onLine;

      const payload = {
        empCode,
        battery: battery.level,
        charging: battery.charging,
        powerSave: battery.powerSave,
        gps: gpsPermission === 'granted',
        internet,
        signalStrength: internet ? 'Good' : 'None',
        permissionStatus: detailedPermission,
        foregroundService: true,
        pendingQueue: queueSize,
        deviceModel: navigator.userAgent.substring(0, 95),
        androidVersion: 'Web/Native WebView',
        appVersion: '2.0.1',
      };

      await axios.post(`${API_BASE}Device/heartbeat`, payload);
      console.log('[HealthService] Heartbeat telemetry sent successfully.');
    } catch (e) {
      console.warn('[HealthService] Failed to transmit heartbeat telemetry:', e);
    }
  }
}
