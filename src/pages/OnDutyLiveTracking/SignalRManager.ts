import * as signalR from '@microsoft/signalr';
import { API_BASE } from '../../config';

export class SignalRManager {
  public static buildConnection(): signalR.HubConnection {
    return new signalR.HubConnectionBuilder()
      .withUrl(API_BASE.replace(/\/api\/$/, '') + '/trackingHub', {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();
  }

  public static async joinDashboardGroup(connection: signalR.HubConnection): Promise<void> {
    try {
      if (connection.state === signalR.HubConnectionState.Connected) {
        await connection.invoke('JoinTrackingDashboard');
        console.log('[SignalRManager] Registered in TrackingDashboards SignalR group.');
      }
    } catch (e) {
      console.warn('[SignalRManager] Failed to join dashboard group:', e);
    }
  }
}
