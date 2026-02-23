import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent, FormsModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent {
  readonly title = 'Настройки';

  readonly userName = signal('Иван Петров');
  readonly userEmail = signal('ivan.petrov@orbita.io');
  readonly avatarUrl = signal<string | null>(null);

  get userInitial(): string {
    return this.userName().charAt(0);
  }

  readonly pushNotifications = signal(true);

  // Edit profile dialog
  readonly showEditDialog = signal(false);
  editName = '';
  editEmail = '';

  togglePushNotifications(): void {
    this.pushNotifications.update(v => !v);
  }

  editProfile(): void {
    this.editName = this.userName();
    this.editEmail = this.userEmail();
    this.showEditDialog.set(true);
  }

  cancelEdit(): void {
    this.showEditDialog.set(false);
  }

  saveEdit(): void {
    const name = this.editName.trim();
    const email = this.editEmail.trim();
    if (name) {
      this.userName.set(name);
    }
    if (email) {
      this.userEmail.set(email);
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

    const reader = new FileReader();
    reader.onload = () => {
      this.avatarUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Reset so the same file can be re-selected
    input.value = '';
  }

  changePassword(): void {
    console.log('change password');
  }

  logout(): void {
    console.log('logout');
  }
}
