import {
  Component, ElementRef, HostListener,
  computed, forwardRef, inject, input, signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  readonly options = input<SelectOption[]>([]);
  readonly placeholder = input('Выбрать');
  readonly icon = input('person');

  private readonly elementRef = inject(ElementRef);

  readonly isOpen = signal(false);
  readonly selectedValue = signal('');

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  readonly displayValue = computed(() => {
    const val = this.selectedValue();
    if (!val) return '';
    const opt = this.options().find(o => o.value === val);
    return opt ? opt.label : '';
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  toggle(): void {
    this.isOpen.update(v => !v);
    this.onTouched();
  }

  select(opt: SelectOption): void {
    this.selectedValue.set(opt.value);
    this.onChange(opt.value);
    this.isOpen.set(false);
  }

  clear(event: MouseEvent): void {
    event.stopPropagation();
    this.selectedValue.set('');
    this.onChange('');
  }

  // ControlValueAccessor
  writeValue(val: string): void {
    this.selectedValue.set(val || '');
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
