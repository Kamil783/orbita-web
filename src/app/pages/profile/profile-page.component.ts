import { Component, signal } from '@angular/core';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent {
  readonly title = 'Настройки';

  readonly userName = 'Иван Петров';
  readonly userEmail = 'ivan.petrov@orbita.io';
  readonly userInitial = 'И';

  readonly pushNotifications = signal(true);

  togglePushNotifications(): void {
    this.pushNotifications.update(v => !v);
  }

  editProfile(): void {
    console.log('edit profile');
  }

  changePassword(): void {
    console.log('change password');
  }

  logout(): void {
    console.log('logout');
  }
}
