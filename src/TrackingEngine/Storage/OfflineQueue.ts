import { LocationPing } from '../Models/TelemetryModels';
import { SQLiteService } from './SQLiteService';

const QUEUE_KEY = 'tracking_offline_gps_queue';

export class OfflineQueue {
  public static async enqueue(ping: LocationPing, maxQueueSize: number = 150): Promise<void> {
    try {
      const queue = await this.getQueue();
      
      // Limit check to prevent memory overflow
      if (queue.length >= maxQueueSize) {
        queue.shift(); // Remove oldest to make room
      }
      
      queue.push(ping);
      await SQLiteService.set(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('[OfflineQueue] Enqueue coordinate failed:', e);
    }
  }

  public static async getQueue(): Promise<LocationPing[]> {
    try {
      const raw = await SQLiteService.get(QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as LocationPing[];
    } catch (e) {
      console.warn('[OfflineQueue] Failed to parse offline queue. resetting.', e);
      return [];
    }
  }

  public static async dequeueBatch(limit: number): Promise<LocationPing[]> {
    const queue = await this.getQueue();
    return queue.slice(0, limit);
  }

  public static async clearBatch(count: number): Promise<void> {
    try {
      const queue = await this.getQueue();
      const updatedQueue = queue.slice(count);
      await SQLiteService.set(QUEUE_KEY, JSON.stringify(updatedQueue));
    } catch (e) {
      console.error('[OfflineQueue] Clear batch failed:', e);
    }
  }

  public static async getQueueSize(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }
}
