import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { UserService } from '../../features/user/data/user.service';
import { AuthService } from '../../features/auth/data/auth.service';
import { CalendarService } from '../../features/calendar/data/calendar.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent, FormsModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent implements OnInit {
  readonly title = 'Настройки';

  protected readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  protected readonly calendarService = inject(CalendarService);
  private readonly http = inject(HttpClient);

  readonly appVersion = environment.appVersion;
  readonly pushNotifications = signal(true);

  // System status
  readonly systemStatus = signal<'ok' | 'error' | 'checking'>('checking');

  // Edit profile dialog
  readonly showEditDialog = signal(false);
  editName = '';
  editEmail = '';

  ngOnInit(): void {
    this.checkSystemStatus();
  }

  checkSystemStatus(): void {
    this.systemStatus.set('checking');
    this.http.get(`${environment.apiUrl}/api/Health/ping`, { responseType: 'text' }).subscribe({
      next: () => this.systemStatus.set('ok'),
      error: () => this.systemStatus.set('error'),
    });
  }

  togglePushNotifications(): void {
    this.pushNotifications.update(v => !v);
  }

  editProfile(): void {
    this.editName = this.userService.name();
    this.editEmail = this.userService.email();
    this.showEditDialog.set(true);
  }

  cancelEdit(): void {
    this.showEditDialog.set(false);
  }

  saveEdit(): void {
    const name = this.editName.trim();
    const email = this.editEmail.trim();
    if (name || email) {
      this.userService.updateLocal(name, email);
    }
    this.showEditDialog.set(false);
  }

  onEditDialogBackdropClick(): void {
    this.showEditDialog.set(false);
  }

  onEditDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  // Avatar file picker
  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.userService.uploadAvatar(file);
    input.value = '';
  }

  deleteAvatar(): void {
    this.userService.deleteAvatar();
  }

  toggleGoogleCalendar(): void {
    if (this.calendarService.googleConnected()) {
      this.calendarService.disconnectGoogle();
    } else {
      this.calendarService.connectGoogle();
    }
  }

  changePassword(): void {
    console.log('change password');
  }

  logout(): void {
    this.authService.logout();
  }
}
