import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../features/user/data/user.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  @Input() title = '';
  @Input() placeholder = 'Поиск...';

  protected readonly userService = inject(UserService);

  toggleTheme(): void {
    console.log('toggle theme');
  }

  openNotifications(): void {
    console.log('notifications');
  }
}
