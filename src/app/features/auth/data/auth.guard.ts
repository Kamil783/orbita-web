import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of, map, catchError } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const loginTree = router.createUrlTree(['/login']);

  // Valid access token in memory — allow immediately
  if (authService.getAccessToken()) {
    return true;
  }

  // No access token but refresh token exists — try to restore session
  if (authService.getRefreshToken()) {
    return authService.tryRestoreSession().pipe(
      map(() => true),
      catchError(() => of(loginTree)),
    );
  }

  return loginTree;
};
