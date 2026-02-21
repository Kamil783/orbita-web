import { Component } from '@angular/core';
import { SlimSidebarComponent } from '../slim-sidebar/slim-sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-app-shell',
  standalone: true,
  imports: [SlimSidebarComponent, TopbarComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {}
