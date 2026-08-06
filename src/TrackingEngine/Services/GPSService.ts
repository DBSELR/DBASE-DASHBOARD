import { Geolocation } from '@capacitor/geolocation';
import { LocationPing } from '../Models/TelemetryModels';

export class GPSService {
  public static async getCurrentPosition(): Promise<LocationPing> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0, // convert m/s to km/h
        heading: position.coords.heading || 0,
        accuracy: position.coords.accuracy || 0,
        recordedAt: new Date(position.timestamp).toISOString(),
      };
    } catch (e) {
      console.error('[GPSService] Error obtaining position:', e);
      throw e;
    }
  }
}
