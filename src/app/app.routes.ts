import { Routes } from '@angular/router';
import { authGuard } from './features/auth/data/auth.guard';

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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/tasks/tasks-page.component').then(m => m.TasksPageComponent),
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/calendar/calendar-page.component').then(m => m.CalendarPageComponent),
  },
  {
    path: 'finance',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/finance/finance-page.component').then(m => m.FinancePageComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/profile/profile-page.component').then(m => m.ProfilePageComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
