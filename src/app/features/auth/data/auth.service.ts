import { Injectable, Injector, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, switchMap, map, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UserService } from '../../user/data/user.service';
import { NotificationService } from '../../notifications/data/notification.service';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

interface JwtPayload {
  exp: number;
  iss: string;
  aud: string;
  [key: string]: unknown;
}

const REFRESH_TOKEN_KEY = 'refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly _isLoggedIn = signal(false);

  readonly isLoggedIn = this._isLoggedIn.asReadonly();

  private accessToken: string | null = null;

  private readonly injector = inject(Injector);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly userService: UserService,
  ) {
    localStorage.removeItem('access_token');
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/api/Auth/login`, credentials).pipe(
      tap(res => this.setTokens(res)),
      switchMap(res => this.userService.loadProfile().pipe(map(() => res))),
      tap(() => {
        const ns = this.injector.get(NotificationService);
        ns.loadNotifications();
        ns.startConnection(() => this.getAccessToken());
      }),
      catchError(err => throwError(() => err)),
    );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<AuthResponse>(`${this.apiUrl}/api/Auth/refresh`, { refreshToken }).pipe(
      tap(res => this.setTokens(res)),
    );
  }

  tryRestoreSession(): Observable<AuthResponse> {
    if (!this.getRefreshToken()) {
      return throwError(() => new Error('No refresh token'));
    }
    return this.refresh();
  }

  logout(): void {
    this.accessToken = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this._isLoggedIn.set(false);
    this.userService.clear();
    this.injector.get(NotificationService).stopConnection();
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    if (this.accessToken && this.isTokenValid(this.accessToken)) {
      return this.accessToken;
    }
    return null;
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private setTokens(res: AuthResponse): void {
    if (!this.isTokenValid(res.accessToken)) {
      throw new Error('Received invalid access token');
    }
    this.accessToken = res.accessToken;
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    this._isLoggedIn.set(true);
  }

  private isTokenValid(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return false;

    if (payload.iss !== 'Orbita') return false;
    if (payload.aud !== 'Orbita.Client') return false;

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) return false;

    return true;
  }

  private decodeToken(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  }
}
