import {
  Component, ElementRef, HostListener, computed, effect,
  forwardRef, inject, input, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const DAY_NAMES_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export interface CalendarDay {
  date: number;
  month: number;  // 0-based
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  iso: string;
}

@Component({
  selector: 'app-date-picker',
  standalone: true,
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  readonly placeholder = input('Выберите дату');

  private readonly elementRef = inject(ElementRef);

  readonly isOpen = signal(false);
  readonly viewYear = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());
  readonly selectedDate = signal<string>(''); // ISO 'YYYY-MM-DD'

  readonly monthNames = MONTH_NAMES_RU;
  readonly dayNames = DAY_NAMES_SHORT_RU;

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  readonly displayValue = computed(() => {
    const iso = this.selectedDate();
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
  });

  readonly viewMonthLabel = computed(
    () => `${MONTH_NAMES_RU[this.viewMonth()]} ${this.viewYear()}`,
  );

  readonly calendarDays = computed<CalendarDay[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const today = new Date();
    const todayIso = this.toIso(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedIso = this.selectedDate();

    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];

    // Previous month fill
    for (let i = startDow - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      const iso = this.toIso(y, m, d);
      days.push({ date: d, month: m, year: y, isCurrentMonth: false, isToday: iso === todayIso, isSelected: iso === selectedIso, iso });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = this.toIso(year, month, d);
      days.push({ date: d, month, year, isCurrentMonth: true, isToday: iso === todayIso, isSelected: iso === selectedIso, iso });
    }

    // Next month fill (total 42 cells = 6 weeks)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      const iso = this.toIso(y, m, d);
      days.push({ date: d, month: m, year: y, isCurrentMonth: false, isToday: iso === todayIso, isSelected: iso === selectedIso, iso });
    }

    return days;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close dropdown when clicking outside this specific date picker instance
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  toggle(): void {
    this.isOpen.update(v => !v);
    this.onTouched();

    // If opening and we have a selected date, navigate to its month
    if (this.isOpen()) {
      const iso = this.selectedDate();
      if (iso) {
        const [y, m] = iso.split('-').map(Number);
        this.viewYear.set(y);
        this.viewMonth.set(m - 1);
      }
    }
  }

  prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update(y => y - 1);
    } else {
      this.viewMonth.update(m => m - 1);
    }
  }

  nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update(y => y + 1);
    } else {
      this.viewMonth.update(m => m + 1);
    }
  }

  selectDay(day: CalendarDay): void {
    this.selectedDate.set(day.iso);
    this.onChange(day.iso);
    this.isOpen.set(false);
  }

  clear(event: MouseEvent): void {
    event.stopPropagation();
    this.selectedDate.set('');
    this.onChange('');
  }

  // ControlValueAccessor
  writeValue(val: string): void {
    this.selectedDate.set(val || '');
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  private toIso(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
