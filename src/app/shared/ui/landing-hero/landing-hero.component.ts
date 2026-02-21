import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-landing-hero',
  standalone: true,
  templateUrl: './landing-hero.component.html',
  styleUrl: './landing-hero.component.scss',
})
export class LandingHeroComponent {
  @Output() enterClick = new EventEmitter<void>();
}
