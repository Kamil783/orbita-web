import { ApplicationConfig, provideBrowserGlobalErrorListeners, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom, switchMap, tap, of, catchError } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './features/auth/data/auth.interceptor';
import { AuthService } from './features/auth/data/auth.service';
import { UserService } from './features/user/data/user.service';
import { NotificationService } from './features/notifications/data/notification.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      const userService = inject(UserService);
      const notificationService = inject(NotificationService);

      if (authService.getRefreshToken()) {
        return firstValueFrom(
          authService.tryRestoreSession().pipe(
            switchMap(() => userService.loadProfile()),
            tap(() => {
              notificationService.loadNotifications();
              notificationService.startConnection(() => authService.getAccessToken());
            }),
            catchError(() => of(undefined)),
          ),
        );
      }
      return;
    }),
  ]
};
