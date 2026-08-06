export interface BatteryState {
  level: number;
  charging: boolean;
  powerSave: boolean;
}

export class BatteryService {
  public static async getBatteryState(): Promise<BatteryState> {
    try {
      const nav = navigator as any;
      if (nav.getBattery) {
        const battery = await nav.getBattery();
        return {
          level: Math.round(battery.level * 100),
          charging: battery.charging,
          powerSave: false, // standard web API fallback
        };
      }
    } catch (e) {
      console.warn('[BatteryService] Failed to query battery API:', e);
    }
    
    return {
      level: 100,
      charging: false,
      powerSave: false,
    };
  }
}
