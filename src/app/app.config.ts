import { ApplicationConfig, provideBrowserGlobalErrorListeners, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './features/auth/data/auth.interceptor';
import { AuthService } from './features/auth/data/auth.service';
import { UserService } from './features/user/data/user.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      const userService = inject(UserService);

      if (authService.isLoggedIn()) {
        return firstValueFrom(userService.loadProfile());
      }
      return;
    }),
  ]
};
