export interface LocationPing {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  recordedAt: string; // ISO string
}

export interface HeartbeatPayload {
  empCode: string;
  battery: number | null;
  charging: boolean;
  powerSave: boolean;
  gps: boolean;
  internet: boolean;
  signalStrength: string;
  permissionStatus: string;
  foregroundService: boolean;
  pendingQueue: number;
  deviceModel: string;
  androidVersion: string;
  appVersion: string;
}

export interface DeviceConfiguration {
  distanceFilter: number;
  timeFilter: number;
  idleTimeout: number;
  offlineTimeout: number;
  accuracyLimit: number;
  historyInterval: number;
  maximumQueueSize: number;
}
