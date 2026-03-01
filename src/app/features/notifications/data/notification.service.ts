import { Injectable, computed, signal, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../../environments/environment';
import { AppNotification } from '../models/notification.models';

/**
 * API endpoints:
 *
 * GET    /api/Notifications                → AppNotification[]  Load all notifications for the current user
 * POST   /api/Notifications/test           → AppNotification    Send a test notification to the current user
 * PATCH  /api/Notifications/:id/read       → void               Mark a single notification as read
 * POST   /api/Notifications/read-all       → void               Mark all notifications as read
 *
 * SignalR hub: /hubs/notifications
 *   Server → Client: ReceiveNotification(AppNotification)
 */

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  private hubConnection: signalR.HubConnection | null = null;
  private tokenFactory: (() => string | null) | null = null;

  private readonly _notifications = signal<AppNotification[]>([]);
  private readonly _toasts = signal<AppNotification[]>([]);

  readonly notifications = this._notifications.asReadonly();
  readonly toasts = this._toasts.asReadonly();

  readonly unreadCount = computed(() =>
    this._notifications().filter(n => !n.read).length,
  );

  /** Load initial notifications from API */
  loadNotifications(): void {
    this.http.get<AppNotification[]>(`${this.apiUrl}/api/Notifications`)
      .subscribe(list => this._notifications.set(list));
  }

  /** Start SignalR connection */
  startConnection(tokenFactory: () => string | null): void {
    if (this.hubConnection) return;

    this.tokenFactory = tokenFactory;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/hubs/notifications`, {
        accessTokenFactory: () => this.tokenFactory?.() ?? '',
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ReceiveNotification', (notification: AppNotification) => {
      this.handleIncoming(notification);
    });

    this.hubConnection.start().catch(err => {
      console.warn('SignalR connection failed (hub not available yet):', err.message);
    });
  }

  /** Stop SignalR connection */
  stopConnection(): void {
    this.hubConnection?.stop();
    this.hubConnection = null;
    this.tokenFactory = null;
  }

  /** Push a notification (used by SignalR callback) */
  handleIncoming(notification: AppNotification): void {
    this._notifications.update(list => [notification, ...list]);

    this._toasts.update(list => [...list, notification]);

    setTimeout(() => {
      this.dismissToast(notification.id);
    }, 5000);
  }

  dismissToast(id: string): void {
    this._toasts.update(list => list.filter(n => n.id !== id));
  }

  markAsRead(id: string): void {
    this._notifications.update(list =>
      list.map(n => (n.id === id ? { ...n, read: true } : n)),
    );
    this.http.patch(`${this.apiUrl}/api/Notifications/${id}/read`, {}).subscribe();
  }

  markAllAsRead(): void {
    this._notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.http.post(`${this.apiUrl}/api/Notifications/read-all`, {}).subscribe();
  }

  /** Send a test notification via the API */
  sendTestNotification(): void {
    this.http.post<AppNotification>(`${this.apiUrl}/api/Notifications/test`, {}).subscribe(notification => {
      this.handleIncoming(notification);
    });
  }

  ngOnDestroy(): void {
    this.stopConnection();
  }
}
