import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class SignalrService {
    private hubConnection?: HubConnection;
    private notificationSubject = new Subject<Notification>();
    public notification$ = this.notificationSubject.asObservable();

    async connect(accessToken: string): Promise<void> {
        this.hubConnection = new HubConnectionBuilder()
            .withUrl(`${environment.socketUrl}/socket.io/`, {
                accessTokenFactory: () => accessToken
            })
            .configureLogging(LogLevel.Information)
            .withAutomaticReconnect()
            .build();

        this.hubConnection.on('notification', (notification: Notification) => {
            this.notificationSubject.next(notification);
        });

        this.hubConnection.on('connected', (data: any) => {
            console.log('Connected to SignalR hub:', data);
        });

        try {
            await this.hubConnection.start();
            console.log('SignalR connection established');
        } catch (err) {
            console.error('Error connecting to SignalR:', err);
            throw err;
        }
    }

    async disconnect(): Promise<void> {
        if (this.hubConnection) {
            await this.hubConnection.stop();
            this.hubConnection = undefined;
        }
    }

    subscribe(channel: string): void {
        if (this.hubConnection) {
            this.hubConnection.invoke('subscribe', { channel });
        }
    }

    unsubscribe(channel: string): void {
        if (this.hubConnection) {
            this.hubConnection.invoke('unsubscribe', { channel });
        }
    }
}
