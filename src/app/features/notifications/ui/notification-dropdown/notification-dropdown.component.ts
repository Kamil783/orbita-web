import { Component, inject } from '@angular/core';
import { NotificationService } from '../../data/notification.service';
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS } from '../../models/notification.models';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  templateUrl: './notification-dropdown.component.html',
  styleUrl: './notification-dropdown.component.scss',
})
export class NotificationDropdownComponent {
  protected readonly notificationService = inject(NotificationService);
  protected readonly icons = NOTIFICATION_ICONS;
  protected readonly colors = NOTIFICATION_COLORS;

  formatTime(date: Date): string {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч. назад`;
    const days = Math.floor(hours / 24);
    return `${days} дн. назад`;
  }
}
