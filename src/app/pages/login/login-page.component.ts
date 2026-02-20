import { Component } from '@angular/core';
import { LoginCardComponent } from '../../features/auth/login-card/login-card.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [LoginCardComponent],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {}
