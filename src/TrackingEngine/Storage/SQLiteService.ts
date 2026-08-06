import { Preferences } from '@capacitor/preferences';

export class SQLiteService {
  public static async get(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch (e) {
      console.warn(`[SQLiteService] Preferences.get failed for key ${key}:`, e);
      return localStorage.getItem(key);
    }
  }

  public static async set(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch (e) {
      console.warn(`[SQLiteService] Preferences.set failed for key ${key}:`, e);
      localStorage.setItem(key, value);
    }
  }

  public static async remove(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch (e) {
      console.warn(`[SQLiteService] Preferences.remove failed for key ${key}:`, e);
      localStorage.removeItem(key);
    }
  }

  public static async clear(): Promise<void> {
    try {
      await Preferences.clear();
    } catch (e) {
      console.warn('[SQLiteService] Preferences.clear failed:', e);
      localStorage.clear();
    }
  }
}
