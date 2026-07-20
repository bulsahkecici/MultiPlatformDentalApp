import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/models';

/**
 * Socket.IO tabanlı gerçek zamanlı bildirim servisi.
 * Backend sözleşmesi (src/services/notificationHub.js):
 *  - Kimlik doğrulama: handshake auth.token içinde JWT
 *  - Eventler: 'connected' (bağlantı onayı), 'notification' ({type,title,message,data,timestamp})
 *  - İstemci -> sunucu: 'subscribe'/'unsubscribe' ({channel})
 */
@Injectable({
    providedIn: 'root'
})
export class SocketService {
    private socket?: Socket;
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
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000
        });

        this.socket.on('notification', (notification: Notification) => {
            this.notificationSubject.next(notification);
        });

        this.socket.on('connected', (data: unknown) => {
            console.log('Bildirim sunucusuna bağlanıldı:', data);
        });

        this.socket.on('connect_error', (err: Error) => {
            console.warn('Bildirim bağlantı hatası:', err.message);
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = undefined;
        }
    }

    subscribe(channel: string): void {
        this.socket?.emit('subscribe', { channel });
    }

    unsubscribe(channel: string): void {
        this.socket?.emit('unsubscribe', { channel });
    }
}
