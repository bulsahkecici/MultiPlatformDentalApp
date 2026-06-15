import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class NotificationSocketService {
  private socket: Socket | null = null;
  private notificationSubject = new Subject<Notification>();
  public notification$ = this.notificationSubject.asObservable();

  connect(accessToken: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.disconnect();

    this.socket = io(environment.socketUrl, {
      path: '/socket.io/',
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    this.socket.on('connected', () => {
      // Socket.IO hub ready
    });

    this.socket.on('notification', (payload: Notification) => {
      this.notificationSubject.next(payload);
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('Socket.IO bağlantı hatası:', err.message);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribe(channel: string): void {
    this.socket?.emit('subscribe', { channel });
  }

  unsubscribe(channel: string): void {
    this.socket?.emit('unsubscribe', { channel });
  }
}
