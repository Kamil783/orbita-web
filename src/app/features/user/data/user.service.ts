import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = environment.apiUrl;

  private readonly _name = signal('');
  private readonly _email = signal('');
  private readonly _avatar = signal<string | null>(null);
  private readonly _loaded = signal(false);

  readonly name = this._name.asReadonly();
  readonly email = this._email.asReadonly();
  readonly avatar = this._avatar.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly avatarUrl = computed(() => {
    const bytes = this._avatar();
    return bytes ? `data:image/png;base64,${bytes}` : null;
  });

  readonly initial = computed(() => {
    const n = this._name();
    return n ? n.charAt(0).toUpperCase() : '?';
  });

  constructor(private readonly http: HttpClient) {}

  loadProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/api/User/profile`).pipe(
      tap(profile => {
        this._name.set(profile.name);
        this._email.set(profile.email);
        this._avatar.set(profile.avatar ?? null);
        this._loaded.set(true);
      }),
      catchError(err => {
        console.error('Failed to load user profile', err);
        return of({ name: '', email: '' } as UserProfile);
      }),
    );
  }

  /**
   * PUT /api/User/profile  Body: { name, email }  → UserProfile
   */
  updateProfile(name: string, email: string): void {
    if (name) this._name.set(name);
    if (email) this._email.set(email);

    this.http.put<UserProfile>(`${this.apiUrl}/api/User/profile`, { name, email }).pipe(
      tap(profile => {
        this._name.set(profile.name);
        this._email.set(profile.email);
      }),
      catchError(err => {
        console.error('Failed to update profile', err);
        return of(null);
      }),
    ).subscribe();
  }

  /**
   * PUT /api/User/avatar  Body: multipart FormData (file)  → { avatar: string }
   */
  uploadAvatar(file: File): void {
    const formData = new FormData();
    formData.append('file', file);

    this.http.put<{ avatar: string }>(`${this.apiUrl}/api/User/avatar`, formData).pipe(
      tap(res => {
        this._avatar.set(res.avatar);
      }),
      catchError(err => {
        console.error('Failed to upload avatar', err);
        return of(null);
      }),
    ).subscribe();
  }

  /** @deprecated Use updateProfile() instead */
  updateLocal(name: string, email: string): void {
    this.updateProfile(name, email);
  }

  clear(): void {
    this._name.set('');
    this._email.set('');
    this._avatar.set(null);
    this._loaded.set(false);
  }
}
