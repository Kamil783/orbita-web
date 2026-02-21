import { Component } from '@angular/core';

@Component({
  selector: 'app-landing-footer',
  standalone: true,
  templateUrl: './landing-footer.component.html',
  styleUrl: './landing-footer.component.scss',
})
export class LandingFooterComponent {
  year = new Date().getFullYear();
}
