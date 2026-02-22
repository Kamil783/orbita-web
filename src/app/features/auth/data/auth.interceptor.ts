import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Don't attach token to auth endpoints
  if (req.url.includes('/api/Auth/')) {
    return next(req);
  }

  const token = authService.getAccessToken();
  const authedReq = token ? addToken(req, token) : req;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isRefreshing) {
        return handleRefresh(authService, req, next);
      }
      return throwError(() => error);
    }),
  );
};

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

function handleRefresh(
  authService: AuthService,
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) {
  isRefreshing = true;

  return authService.refresh().pipe(
    switchMap(res => {
      isRefreshing = false;
      return next(addToken(req, res.accessToken));
    }),
    catchError(err => {
      isRefreshing = false;
      authService.logout();
      return throwError(() => err);
    }),
  );
}
