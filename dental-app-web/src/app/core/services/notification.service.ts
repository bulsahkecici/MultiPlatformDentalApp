import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Notification } from '../models/models';

/**
 * Kalıcı bildirimler için REST API servisi (backend: src/routes/notifications.js).
 */
@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    constructor(private apiService: ApiService) {}

    getNotifications(limit = 20, offset = 0): Observable<{ notifications: Notification[] }> {
        return this.apiService.get<{ notifications: Notification[] }>(
            `/api/notifications?limit=${limit}&offset=${offset}`
        );
    }

    getUnreadCount(): Observable<{ count: number }> {
        return this.apiService.get<{ count: number }>('/api/notifications/unread-count');
    }

    markAsRead(id: number): Observable<unknown> {
        return this.apiService.put(`/api/notifications/${id}/read`, {});
    }

    markAllAsRead(): Observable<unknown> {
        return this.apiService.put('/api/notifications/read-all', {});
    }

    deleteNotification(id: number): Observable<unknown> {
        return this.apiService.delete(`/api/notifications/${id}`);
    }
}
