import { Injectable, Renderer2, RendererFactory2, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly STORAGE_KEY = 'orbita-theme';
  private readonly blockedRoutes = new Set(['', 'login']);

  private readonly router = inject(Router);
  private readonly renderer: Renderer2;

  private readonly preferredTheme = signal<Theme>(this.readStoredTheme());
  readonly theme = signal<Theme>('light');

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.applyThemeForUrl(this.router.url);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.applyThemeForUrl(event.urlAfterRedirects));
  }

  get isDarkTheme(): boolean {
    return this.theme() === 'dark';
  }

  toggleTheme(): void {
    const nextTheme: Theme = this.preferredTheme() === 'dark' ? 'light' : 'dark';
    this.preferredTheme.set(nextTheme);
    localStorage.setItem(ThemeService.STORAGE_KEY, nextTheme);
    this.applyThemeForUrl(this.router.url);
  }

  private applyThemeForUrl(url: string): void {
    const activeTheme = this.isBlockedRoute(url) ? 'light' : this.preferredTheme();
    this.theme.set(activeTheme);
    this.renderer.setAttribute(document.documentElement, 'data-theme', activeTheme);
  }

  private isBlockedRoute(url: string): boolean {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const segment = cleanUrl.replace(/^\//, '').split('/')[0] ?? '';
    return this.blockedRoutes.has(segment);
  }

  private readStoredTheme(): Theme {
    return localStorage.getItem(ThemeService.STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  }
}
