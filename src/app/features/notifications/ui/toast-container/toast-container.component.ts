import { Component, inject } from '@angular/core';
import { NotificationService } from '../../data/notification.service';
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS } from '../../models/notification.models';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss',
})
export class ToastContainerComponent {
  protected readonly notificationService = inject(NotificationService);
  protected readonly icons = NOTIFICATION_ICONS;
  protected readonly colors = NOTIFICATION_COLORS;
}
