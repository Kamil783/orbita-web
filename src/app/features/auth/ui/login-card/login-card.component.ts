import { Component } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { FloatingInputComponent } from '../../../../shared/ui/floating-input/floating-input.component';

@Component({
  selector: 'app-login-card',
  standalone: true,
  imports: [ReactiveFormsModule, FloatingInputComponent],
  templateUrl: './login-card.component.html',
  styleUrl: './login-card.component.scss',
})
export class LoginCardComponent {
  form: FormGroup;

  constructor(private readonly fb: FormBuilder) {
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
    console.log('login', this.form.value);
  }

  forgotPassword(): void {
    console.log('forgot password');
  }

  signup(): void {
    console.log('signup');
  }
}
