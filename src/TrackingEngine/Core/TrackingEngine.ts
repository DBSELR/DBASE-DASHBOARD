import { GPSService } from '../Services/GPSService';
import { PermissionService } from '../Services/PermissionService';
import { SessionManager, TrackingSession } from './SessionManager';
import { OfflineQueue } from '../Storage/OfflineQueue';
import { SyncService } from '../Network/SyncService';
import { SignalRService } from '../Network/SignalRService';
import { HealthService } from '../Services/HealthService';
import { Capacitor } from '@capacitor/core';
import { SQLiteService } from '../Storage/SQLiteService';
import { BackgroundGeolocation } from './BackgroundPlugin';

const ENGINE_STATE_KEY = 'tracking_engine_is_active';

export class TrackingEngine {
  private static activeSession: TrackingSession | null = null;
  private static isEngineActive = false;
  private static browserIntervalId: any = null;
  private static watcherId: string | null = null;

  public static async initialize(empCode: string): Promise<void> {
    // Self-healing check: check if there is an active session stored locally
    const session = await SessionManager.getActiveSession();
    const activeState = await SQLiteService.get(ENGINE_STATE_KEY);
    
    if (session && activeState === 'true') {
      console.log('[TrackingEngine] Auto-recovering active session:', session.sessionId);
      this.activeSession = session;
      this.isEngineActive = true;
      this.startTrackingWatchers(empCode);
    }
  }

  public static async start(empCode: string): Promise<boolean> {
    if (this.isEngineActive) return true;

    // Verify location permissions first
    const gpsPermission = await PermissionService.requestGPSPermissions();
    if (gpsPermission !== 'granted') {
      console.warn('[TrackingEngine] Foreground GPS permission not granted.');
      return false;
    }

    const bgPermission = await PermissionService.checkBackgroundPermissions();
    if (!bgPermission && Capacitor.isNativePlatform()) {
      console.warn('[TrackingEngine] Background location permission not granted.');
      // Proceed but alert user via system settings redirect
      await PermissionService.openSystemSettings();
    }

    // Start remote session
    const session = await SessionManager.startSession(empCode);
    if (!session) {
      console.error('[TrackingEngine] Failed to initialize session on backend.');
      return false;
    }

    this.activeSession = session;
    this.isEngineActive = true;
    await SQLiteService.set(ENGINE_STATE_KEY, 'true');

    // Start background telemetry and location watchers
    this.startTrackingWatchers(empCode);

    return true;
  }

  public static async stop(): Promise<void> {
    this.isEngineActive = false;
    await SQLiteService.remove(ENGINE_STATE_KEY);

    // Stop watchers
    this.stopTrackingWatchers();

    // End remote session
    await SessionManager.stopSession();
    this.activeSession = null;
  }

  public static isActive(): boolean {
    return this.isEngineActive;
  }

  public static getSessionId(): number | null {
    return this.activeSession?.sessionId ?? null;
  }

  private static startTrackingWatchers(empCode: string): void {
    // 1. Start SignalR for instant admin requests
    SignalRService.startConnection(empCode, () => {
      this.syncSinglePosition();
    });

    // 2. Start Health heartbeat query (every 3 minutes)
    HealthService.startHeartbeat(empCode, 180000);

    // 3. Start Geolocation Watcher
    if (Capacitor.isNativePlatform()) {
      this.startNativeWatcher();
    } else {
      this.startBrowserInterval(empCode);
    }

    // 4. Flush offline queue if online
    if (navigator.onLine) {
      this.flushOfflineQueue();
    }
  }

  private static stopTrackingWatchers(): void {
    SignalRService.stopConnection();
    HealthService.stopHeartbeat();

    if (this.browserIntervalId) {
      clearInterval(this.browserIntervalId);
      this.browserIntervalId = null;
    }

    if (this.watcherId) {
      BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      this.watcherId = null;
    }
  }

  private static async startNativeWatcher(): Promise<void> {
    try {
      if (this.watcherId) {
        await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
        this.watcherId = null;
      }

      this.watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Your coordinates are synced with management while on-duty.",
          backgroundTitle: "Field Location Tracking Active",
          requestPermissions: true,
          stale: true,
          distanceFilter: 15, // trigger every 15 meters
        },
        async (location: any) => {
          if (!this.isEngineActive || !location) return;

          const ping = {
            latitude: location.latitude,
            longitude: location.longitude,
            speed: location.speed ? Math.round(location.speed * 3.6) : 0,
            heading: location.heading || 0,
            accuracy: location.accuracy || 0,
            recordedAt: new Date(location.time).toISOString(),
          };

          await this.processIncomingLocation(ping);
        }
      );
    } catch (e) {
      console.error('[TrackingEngine] Failed to start native watcher:', e);
    }
  }

  private static startBrowserInterval(empCode: string): void {
    if (this.browserIntervalId) clearInterval(this.browserIntervalId);

    this.browserIntervalId = setInterval(async () => {
      if (!this.isEngineActive) return;
      await this.syncSinglePosition();
    }, 30000); // Poll every 30 seconds on browser
  }

  public static async syncSinglePosition(): Promise<void> {
    try {
      const ping = await GPSService.getCurrentPosition();
      await this.processIncomingLocation(ping);
    } catch (e) {
      console.warn('[TrackingEngine] Failed to sync single position snapshot:', e);
    }
  }

  private static async processIncomingLocation(ping: any): Promise<void> {
    if (!this.activeSession) return;

    const empCode = this.activeSession.empCode;
    const sessionId = this.activeSession.sessionId;

    // A. Store offline queue first (bulletproof recovery)
    await OfflineQueue.enqueue(ping);

    if (navigator.onLine) {
      // B. Attempt upload
      const success = await SyncService.syncLocation(empCode, sessionId, ping);
      if (success) {
        // C. Clear from offline queue if uploaded
        const queueSize = await OfflineQueue.getQueueSize();
        if (queueSize > 0) {
          await OfflineQueue.clearBatch(1);
        }
        
        // D. Flush any pending backlog
        await this.flushOfflineQueue();
      }
    }
  }

  public static async flushOfflineQueue(): Promise<void> {
    if (!this.activeSession || !navigator.onLine) return;

    const empCode = this.activeSession.empCode;
    const sessionId = this.activeSession.sessionId;

    const queueSize = await OfflineQueue.getQueueSize();
    if (queueSize === 0) return;

    console.log(`[TrackingEngine] Flushing ${queueSize} offline coordinates...`);
    const batch = await OfflineQueue.dequeueBatch(50); // Flush up to 50 at a time
    const success = await SyncService.batchSyncLocations(empCode, sessionId, batch);
    
    if (success) {
      await OfflineQueue.clearBatch(batch.length);
      // Recursively flush remaining if any
      const remainingSize = await OfflineQueue.getQueueSize();
      if (remainingSize > 0) {
        await this.flushOfflineQueue();
      }
    }
  }
}
