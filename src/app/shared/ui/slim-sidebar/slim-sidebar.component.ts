import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type NavItem = { icon: string; label: string; active?: boolean };

@Component({
  selector: 'app-slim-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './slim-sidebar.component.html',
  styleUrl: './slim-sidebar.component.scss',
})
export class SlimSidebarComponent {
  items: NavItem[] = [
    { icon: 'check_circle', label: 'Задачи', active: true },
    { icon: 'calendar_month', label: 'Расписание' },
    { icon: 'nutrition', label: 'Здоровье' },
    { icon: 'payments', label: 'Финансы' },
  ];
}
