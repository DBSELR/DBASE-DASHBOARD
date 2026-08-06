import * as signalR from '@microsoft/signalr';
import { API_BASE } from '../../config';

export class SignalRService {
  private static connection: signalR.HubConnection | null = null;

  public static startConnection(
    empCode: string,
    onRequestPing: () => void
  ): void {
    if (this.connection) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(API_BASE.replace(/\/api\/$/, '') + '/trackingHub', {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on('RequestLivePing', (targetEmpCode: string) => {
      if (targetEmpCode === empCode) {
        console.log('[SignalRService] Received admin GPS fetch request.');
        onRequestPing();
      }
    });

    this.connection.start()
      .then(() => {
        console.log('[SignalRService] Connected to tracking websocket.');
      })
      .catch((err) => {
        console.warn('[SignalRService] WebSockets connection failed:', err);
      });
  }

  public static stopConnection(): void {
    if (this.connection) {
      this.connection.stop();
      this.connection = null;
    }
  }
}
