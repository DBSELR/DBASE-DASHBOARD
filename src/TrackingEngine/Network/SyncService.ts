import axios from 'axios';
import { API_BASE } from '../../config';
import { LocationPing } from '../Models/TelemetryModels';

export class SyncService {
  public static async syncLocation(
    empCode: string,
    sessionId: number,
    ping: LocationPing
  ): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE}Tracking/sync-location`, {
        empCode,
        sessionId,
        latitude: ping.latitude,
        longitude: ping.longitude,
        speed: ping.speed,
        heading: ping.heading,
        accuracy: ping.accuracy,
        movementStatus: ping.speed > 3 ? 'Moving' : 'Idle',
      });
      return response.status === 200;
    } catch (e) {
      console.warn('[SyncService] syncLocation failed:', e);
      return false;
    }
  }

  public static async batchSyncLocations(
    empCode: string,
    sessionId: number,
    pings: LocationPing[]
  ): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE}Tracking/batch-sync-locations`, {
        empCode,
        sessionId,
        locations: pings.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          speed: p.speed,
          heading: p.heading,
          accuracy: p.accuracy,
          recordedAt: p.recordedAt,
        })),
      });
      return response.status === 200;
    } catch (e) {
      console.warn('[SyncService] batchSyncLocations failed:', e);
      return false;
    }
  }
}
