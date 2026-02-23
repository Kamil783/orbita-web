import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

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

  toggleTheme(): void {
    console.log('toggle theme');
  }

  openNotifications(): void {
    console.log('notifications');
  }
}
