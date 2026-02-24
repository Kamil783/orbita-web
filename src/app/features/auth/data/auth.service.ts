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

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly _isLoggedIn = signal(this.hasToken());

  readonly isLoggedIn = this._isLoggedIn.asReadonly();

  private readonly injector = inject(Injector);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly userService: UserService,
  ) {}

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/api/Auth/login`, credentials).pipe(
      tap(res => this.setTokens(res)),
      switchMap(res => this.userService.loadProfile().pipe(map(() => res))),
      tap(() => {
        const ns = this.injector.get(NotificationService);
        ns.loadNotifications();
        ns.startConnection();
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

  logout(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this._isLoggedIn.set(false);
    this.userService.clear();
    this.injector.get(NotificationService).stopConnection();
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private setTokens(res: AuthResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    this._isLoggedIn.set(true);
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
  }
}
