import { Component, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FloatingInputComponent } from '../../../../shared/ui/floating-input/floating-input.component';
import { AuthService } from '../../data/auth.service';

@Component({
  selector: 'app-login-card',
  standalone: true,
  imports: [ReactiveFormsModule, FloatingInputComponent],
  templateUrl: './login-card.component.html',
  styleUrl: './login-card.component.scss',
})
export class LoginCardComponent {
  form: FormGroup;
  errorMessage = signal('');
  loading = signal(false);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.loading.set(true);

    this.authService.login(this.form.value).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/tasks']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 401 || err.status === 400) {
          this.errorMessage.set('Неверный email или пароль');
        } else {
          this.errorMessage.set('Ошибка сервера. Попробуйте позже.');
        }
      },
    });
  }

  forgotPassword(): void {
    console.log('forgot password');
  }

  signup(): void {
    console.log('signup');
  }
}
