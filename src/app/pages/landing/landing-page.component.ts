import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LandingShellComponent } from '../../shared/ui/landing-shell/landing-shell.component';
import { LandingHeaderComponent } from '../../shared/ui/landing-header/landing-header.component';
import { LandingHeroComponent } from '../../shared/ui/landing-hero/landing-hero.component';
import { LandingPreviewComponent } from '../../shared/ui/landing-preview/landing-preview.component';
import { LandingFooterComponent } from '../../shared/ui/landing-footer/landing-footer.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    LandingShellComponent,
    LandingHeaderComponent,
    LandingHeroComponent,
    LandingPreviewComponent,
    LandingFooterComponent,
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
  constructor(private readonly router: Router) {}

  onEnter(): void {
    this.router.navigate(['/login']);
  }
}
