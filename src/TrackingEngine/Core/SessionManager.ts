import axios from 'axios';
import { API_BASE } from '../../config';
import { SQLiteService } from '../Storage/SQLiteService';

export interface TrackingSession {
  sessionId: number;
  empCode: string;
  sessionType: string;
  referenceId: string;
  clientName: string;
  description: string;
}

const SESSION_KEY = 'current_tracking_session';

export class SessionManager {
  public static async getActiveSession(): Promise<TrackingSession | null> {
    try {
      const raw = await SQLiteService.get(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as TrackingSession;
    } catch (e) {
      console.warn('[SessionManager] Failed to read cached active session:', e);
      return null;
    }
  }

  public static async startSession(empCode: string, sessionType: string = 'OnDuty'): Promise<TrackingSession | null> {
    try {
      const response = await axios.post(`${API_BASE}Session/auto-start-session`, {
        empCode,
        sessionType,
      });

      if (response.status === 200 && response.data?.sessionId) {
        const session: TrackingSession = {
          sessionId: response.data.sessionId,
          empCode: response.data.empCode,
          sessionType: response.data.sessionType,
          referenceId: response.data.referenceId,
          clientName: response.data.clientName,
          description: response.data.description,
        };

        await SQLiteService.set(SESSION_KEY, JSON.stringify(session));
        return session;
      }
    } catch (e) {
      console.error('[SessionManager] Failed to start tracking session:', e);
    }
    return null;
  }

  public static async stopSession(): Promise<void> {
    try {
      const session = await this.getActiveSession();
      if (session) {
        await axios.post(`${API_BASE}Session/close-session`, {
          sessionId: session.sessionId,
          empCode: session.empCode,
        });
      }
    } catch (e) {
      console.warn('[SessionManager] Remote close-session call failed:', e);
    } finally {
      await SQLiteService.remove(SESSION_KEY);
    }
  }
}
