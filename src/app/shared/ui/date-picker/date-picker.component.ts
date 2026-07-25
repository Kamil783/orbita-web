import {
  Component, DestroyRef, ElementRef, HostListener, computed, effect,
  forwardRef, inject, input, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const DAY_NAMES_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Default dropdown size in px — used before the calendar has rendered. */
const DROPDOWN_WIDTH = 280;
const DROPDOWN_HEIGHT = 340;
/** Minimum gap kept between the dropdown and the viewport edges. */
const VIEWPORT_MARGIN = 8;

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
  readonly dropdownAlign = input<'left' | 'right'>('left');

  private static openInstance: DatePickerComponent | null = null;

  private readonly elementRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly isOpen = signal(false);
  readonly viewYear = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());
  readonly selectedDate = signal<string>(''); // ISO 'YYYY-MM-DD'

  // The dropdown is `position: fixed` and placed from JS: several hosts
  // (transactions card, dialogs) clip it with `overflow: hidden`, and an
  // absolutely positioned calendar would simply get cut off there.
  readonly dropdownPos = signal<{ top: number; left: number; width: number }>({
    top: 0, left: 0, width: DROPDOWN_WIDTH,
  });

  private readonly dropdownRef = viewChild<ElementRef<HTMLElement>>('dropdown');

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
      if (this.isOpen()) {
        this.isOpen.set(false);
        if (DatePickerComponent.openInstance === this) {
          DatePickerComponent.openInstance = null;
        }
      }
    }
  }

  constructor() {
    // Re-place with the real height once the calendar is in the DOM: the first
    // placement runs before it renders and has to guess.
    effect(() => {
      const el = this.dropdownRef()?.nativeElement;
      if (el) this.updateDropdownPosition(el.offsetHeight);
    });

    // `fixed` doesn't move with the scrolling ancestor, so follow it manually.
    // Capture phase: scroll doesn't bubble out of the inner scroll containers.
    const reposition = () => {
      if (this.isOpen()) {
        this.updateDropdownPosition(this.dropdownRef()?.nativeElement.offsetHeight);
      }
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    });
  }

  toggle(): void {
    // Close any other open date picker before toggling
    if (DatePickerComponent.openInstance && DatePickerComponent.openInstance !== this) {
      DatePickerComponent.openInstance.isOpen.set(false);
    }

    this.isOpen.update(v => !v);
    DatePickerComponent.openInstance = this.isOpen() ? this : null;
    this.onTouched();

    // If opening and we have a selected date, navigate to its month
    if (this.isOpen()) {
      const iso = this.selectedDate();
      if (iso) {
        const [y, m] = iso.split('-').map(Number);
        this.viewYear.set(y);
        this.viewMonth.set(m - 1);
      }
      this.updateDropdownPosition();
    }
  }

  /**
   * Places the calendar right below the input. It always opens downwards; when
   * it would run past the bottom of the screen it slides up just enough to stay
   * fully visible instead of flipping above the input.
   */
  private updateDropdownPosition(measuredHeight?: number): void {
    const rect: DOMRect = this.elementRef.nativeElement.getBoundingClientRect();
    const margin = VIEWPORT_MARGIN;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const width = Math.min(DROPDOWN_WIDTH, viewportW - margin * 2);
    const height = measuredHeight || DROPDOWN_HEIGHT;

    let left = this.dropdownAlign() === 'right' ? rect.right - width : rect.left;
    left = Math.min(Math.max(left, margin), viewportW - width - margin);

    let top = rect.bottom + 6;
    const maxTop = viewportH - height - margin;
    if (top > maxTop) top = Math.max(margin, maxTop);

    this.dropdownPos.set({ top, left, width });
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
    DatePickerComponent.openInstance = null;
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
