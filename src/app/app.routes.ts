import { Routes } from '@angular/router';
import { LandingPageComponent } from './pages/landing/landing-page.component';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing-page.component').then(m => m.LandingPageComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login-page.component').then(m => m.LoginPageComponent),
  },
  {
    path: 'tasks',
    loadComponent: () =>
      import('./pages/tasks/tasks-page.component').then(m => m.TasksPageComponent),
  }
];
