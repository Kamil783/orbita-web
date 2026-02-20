import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-topbar',
  standalone: true,
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
