import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { BackgroundGeolocation } from '../Core/BackgroundPlugin';

export class PermissionService {
  /**
   * Checks current permission states.
   * Returns 'granted', 'prompt', or 'denied'
   */
  public static async checkGPSPermissions(): Promise<'granted' | 'prompt' | 'denied'> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (status.state === 'granted') return 'granted';
          if (status.state === 'denied') return 'denied';
          return 'prompt';
        } catch {
          return 'granted';
        }
      }
      return typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'granted' : 'denied';
    }

    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted') return 'granted';
      if (status.location === 'denied') return 'denied';
      return 'prompt';
    } catch (e) {
      console.warn('[PermissionService] Failed to check GPS permissions:', e);
      return 'prompt';
    }
  }

  /**
   * Requests foreground location permission.
   */
  public static async requestGPSPermissions(): Promise<'granted' | 'prompt' | 'denied'> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        return 'denied';
      }
      try {
        if ('permissions' in navigator && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (status.state === 'granted') return 'granted';
          if (status.state === 'denied') return 'denied';
        }
      } catch {
        // Permissions query not supported or failed
      }
      return new Promise<'granted' | 'prompt' | 'denied'>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (err) => {
            if (err.code === 1) resolve('denied'); // PERMISSION_DENIED
            else resolve('granted'); // TIMEOUT or POSITION_UNAVAILABLE still means permission was granted
          },
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
        );
      });
    }

    try {
      const status = await Geolocation.requestPermissions();
      if (status.location === 'granted') return 'granted';
      if (status.location === 'denied') return 'denied';
      return 'prompt';
    } catch (e) {
      console.warn('[PermissionService] Geolocation requestPermissions failed:', e);
      return 'denied';
    }
  }

  /**
   * Checks background geolocation watcher permissions (Native mobile only).
   */
  public static async checkBackgroundPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return true; // web mock passes background checks
    }

    try {
      // Test add watcher to trigger permission check
      const watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Verifying background GPS accuracy.",
          backgroundTitle: "GPS Sync Active",
          requestPermissions: true,
          stale: true,
          distanceFilter: 50,
        },
        () => {}
      );
      await BackgroundGeolocation.removeWatcher({ id: watcherId });
      return true;
    } catch (e) {
      console.warn('[PermissionService] Background location permission check failed:', e);
      return false;
    }
  }

  /**
   * Returns precise descriptive status: 'Granted', 'Foreground Only', 'Missing Background', or 'Denied'
   */
  public static async getDetailedPermissionStatus(): Promise<string> {
    try {
      const fgState = await this.checkGPSPermissions();
      if (fgState === 'denied') return 'Denied';
      if (fgState === 'prompt') return 'Prompt Needed';
      
      if (Capacitor.isNativePlatform()) {
        const bgState = await this.checkBackgroundPermissions();
        if (!bgState) return 'Missing Background';
      }
      return 'Granted';
    } catch {
      return 'Denied';
    }
  }

  /**
   * Opens device system app settings page.
   */
  public static async openSystemSettings(): Promise<void> {
    try {
      await BackgroundGeolocation.openSettings();
    } catch (e) {
      console.error('[PermissionService] Failed to open system settings:', e);
    }
  }
}
