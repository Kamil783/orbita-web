import { Injectable, computed, signal, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../../environments/environment';
import { AppNotification, NotificationType } from '../models/notification.models';

const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: '1',
    type: 'task',
    title: 'Новая задача: Q4 Strategy Deck',
    message: 'Вам назначена задача "Q4 Strategy Deck" от Marcus Doe.',
    read: false,
    createdAt: new Date(Date.now() - 5 * 60_000),
  },
  {
    id: '2',
    type: 'meeting',
    title: 'Синхронизация с Product Team',
    message: 'Встреча Product Sync начнётся через 5 минут.',
    read: false,
    createdAt: new Date(Date.now() - 15 * 60_000),
  },
  {
    id: '3',
    type: 'finance',
    title: 'Финансовый отчёт за октябрь готов',
    message: 'Отчёт доступен для просмотра в разделе "Финансы".',
    read: true,
    createdAt: new Date(Date.now() - 2 * 3600_000),
  },
];

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  private hubConnection: signalR.HubConnection | null = null;

  private readonly _notifications = signal<AppNotification[]>([]);
  private readonly _toasts = signal<AppNotification[]>([]);

  readonly notifications = this._notifications.asReadonly();
  readonly toasts = this._toasts.asReadonly();

  readonly unreadCount = computed(() =>
    this._notifications().filter(n => !n.read).length,
  );

  /** Load initial notifications (called on app start if logged in) */
  loadNotifications(): void {
    // TODO: replace mock with real API call:
    // this.http.get<AppNotification[]>(`${this.apiUrl}/api/Notifications`)
    //   .subscribe(list => this._notifications.set(list));
    this._notifications.set([...MOCK_NOTIFICATIONS]);
  }

  /** Start SignalR connection */
  startConnection(): void {
    if (this.hubConnection) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/hubs/notifications`, {
        accessTokenFactory: () => localStorage.getItem('access_token') ?? '',
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
  }

  /** Push a notification (used by SignalR callback and test button) */
  handleIncoming(notification: AppNotification): void {
    // Add to notification list
    this._notifications.update(list => [notification, ...list]);

    // Show toast
    this._toasts.update(list => [...list, notification]);

    // Auto-remove toast after 5s
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
  }

  markAllAsRead(): void {
    this._notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  /** Fire a test notification (for the profile page button) */
  sendTestNotification(): void {
    const types: NotificationType[] = ['task', 'meeting', 'finance', 'alert'];
    const titles: Record<NotificationType, string> = {
      task: 'Назначена новая задача',
      meeting: 'Встреча начинается',
      finance: 'Бюджетное уведомление',
      alert: 'Превышен лимит бюджета',
    };
    const messages: Record<NotificationType, string> = {
      task: 'Вам назначена задача "API Integration v2" от Marcus Doe.',
      meeting: 'Product Sync начнётся через 5 минут. Присоединяйтесь.',
      finance: 'Месячный отчёт о расходах готов к просмотру.',
      alert: 'Месячный бюджет на развлечения достиг порога 90%.',
    };

    const type = types[Math.floor(Math.random() * types.length)];
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      type,
      title: titles[type],
      message: messages[type],
      read: false,
      createdAt: new Date(),
    };

    this.handleIncoming(notification);
  }

  ngOnDestroy(): void {
    this.stopConnection();
  }
}
