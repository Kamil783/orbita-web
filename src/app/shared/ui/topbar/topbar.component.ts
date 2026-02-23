import { Component, ElementRef, HostListener, Input, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../features/user/data/user.service';
import { NotificationService } from '../../../features/notifications/data/notification.service';
import { NotificationDropdownComponent } from '../../../features/notifications/ui/notification-dropdown/notification-dropdown.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, NotificationDropdownComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  @Input() title = '';
  @Input() placeholder = 'Поиск...';

  protected readonly userService = inject(UserService);
  protected readonly notificationService = inject(NotificationService);
  private readonly elRef = inject(ElementRef);

  readonly showNotifications = signal(false);

  toggleTheme(): void {
    console.log('toggle theme');
  }

  toggleNotifications(): void {
    this.showNotifications.update(v => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const wrapper = this.elRef.nativeElement.querySelector('.notify-wrapper');
    if (this.showNotifications() && wrapper && !wrapper.contains(event.target as Node)) {
      this.showNotifications.set(false);
    }
  }
}
