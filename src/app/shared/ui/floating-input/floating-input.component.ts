import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-floating-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-input.component.html',
  styleUrl: './floating-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: FloatingInputComponent,
      multi: true,
    },
  ],
})
export class FloatingInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() type: 'text' | 'email' | 'password' = 'text';

  value = '';
  disabled = false;
  focused = false;

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    this.value = v ?? '';
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  setValue(v: string): void {
    this.value = v;
    this.onChange(v);
  }

  onFocus(): void {
    this.focused = true;
  }

  onBlur(): void {
    this.focused = false;
    this.onTouched();
  }

  get isRaised(): boolean {
    return this.focused || this.value.length > 0;
  }
}
