import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Notification } from '../models/models';

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private apiService: ApiService) {}

  getNotifications(limit = 50, offset = 0): Observable<NotificationsResponse> {
    return this.apiService.get<NotificationsResponse>('/api/notifications', { limit, offset }).pipe(
      tap(response => this.unreadCountSubject.next(response.unreadCount ?? 0))
    );
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.apiService.get<{ count: number }>('/api/notifications/unread-count').pipe(
      tap(response => this.unreadCountSubject.next(response.count ?? 0))
    );
  }

  markAsRead(id: number): Observable<{ notification: Notification }> {
    return this.apiService.put<{ notification: Notification }>(`/api/notifications/${id}/read`, {}).pipe(
      tap(() => {
        const current = this.unreadCountSubject.value;
        if (current > 0) {
          this.unreadCountSubject.next(current - 1);
        }
      })
    );
  }

  markAllAsRead(): Observable<{ message: string }> {
    return this.apiService.put<{ message: string }>('/api/notifications/read-all', {}).pipe(
      tap(() => this.unreadCountSubject.next(0))
    );
  }

  deleteNotification(id: number): Observable<{ message: string }> {
    return this.apiService.delete<{ message: string }>(`/api/notifications/${id}`);
  }

  incrementUnreadCount(): void {
    this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
  }

  get currentUnreadCount(): number {
    return this.unreadCountSubject.value;
  }
}
