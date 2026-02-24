import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

type NavItem = { icon: string; label: string; route: string };

@Component({
  selector: 'app-slim-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './slim-sidebar.component.html',
  styleUrl: './slim-sidebar.component.scss',
})
export class SlimSidebarComponent {
  items: NavItem[] = [
    { icon: 'check_circle', label: 'Задачи', route: '/tasks' },
    { icon: 'calendar_month', label: 'Календарь', route: '/calendar' },
    { icon: 'nutrition', label: 'Здоровье', route: '/health' },
    { icon: 'payments', label: 'Финансы', route: '/finance' },
  ];
}
