import { Routes } from '@angular/router';
import { authGuard } from './features/auth/data/auth.guard';
import { guestGuard } from './features/auth/data/guest.guard';
import { adminGuard } from './features/auth/data/admin.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/landing/landing-page.component').then(m => m.LandingPageComponent),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
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
    path: 'health',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/health/health-page.component').then(m => m.HealthPageComponent),
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
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-page.component').then(m => m.AdminPageComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
