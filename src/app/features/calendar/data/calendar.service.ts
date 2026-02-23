import { Injectable, computed, signal } from '@angular/core';
import { CalendarEvent, CalendarDayInfo, CalendarViewMode, DAY_NAMES_SHORT } from '../models/calendar-event.models';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly _events = signal<CalendarEvent[]>(MOCK_EVENTS);
  private readonly _viewMode = signal<CalendarViewMode>('day');
  private readonly _selectedDate = signal<Date>(new Date());
  private readonly _googleConnected = signal(false);

  readonly events = this._events.asReadonly();
  readonly viewMode = this._viewMode.asReadonly();
  readonly selectedDate = this._selectedDate.asReadonly();
  readonly googleConnected = this._googleConnected.asReadonly();

  readonly selectedDateLabel = computed(() => {
    const d = this._selectedDate();
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  });

  readonly weekLabel = computed(() => {
    const days = this.weekDays();
    const first = days[0].date;
    const last = days[6].date;
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${first.toLocaleDateString('ru-RU', opts)} — ${last.toLocaleDateString('ru-RU', opts)}, ${last.getFullYear()}`;
  });

  readonly weekDays = computed<CalendarDayInfo[]>(() => {
    const d = this._selectedDate();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day === 0 ? 7 : day) - 1));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const check = new Date(date);
      check.setHours(0, 0, 0, 0);
      return {
        date,
        dayOfWeek: DAY_NAMES_SHORT[i],
        dayNumber: date.getDate(),
        isToday: check.getTime() === today.getTime(),
        isWeekend: i >= 5,
      };
    });
  });

  readonly eventsForDay = computed(() => {
    const dateStr = toDateString(this._selectedDate());
    return this._events().filter(e => e.date === dateStr);
  });

  eventsForDate(date: Date): CalendarEvent[] {
    const dateStr = toDateString(date);
    return this._events().filter(e => e.date === dateStr);
  }

  setViewMode(mode: CalendarViewMode): void {
    this._viewMode.set(mode);
  }

  setSelectedDate(date: Date): void {
    this._selectedDate.set(date);
  }

  goToday(): void {
    this._selectedDate.set(new Date());
  }

  goPrev(): void {
    const d = new Date(this._selectedDate());
    if (this._viewMode() === 'day') {
      d.setDate(d.getDate() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    this._selectedDate.set(d);
  }

  goNext(): void {
    const d = new Date(this._selectedDate());
    if (this._viewMode() === 'day') {
      d.setDate(d.getDate() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    this._selectedDate.set(d);
  }

  connectGoogle(): void {
    // TODO: real OAuth integration
    this._googleConnected.set(true);
  }

  disconnectGoogle(): void {
    this._googleConnected.set(false);
    this._events.update(events => events.filter(e => e.type !== 'google'));
  }

  addEvent(event: CalendarEvent): void {
    this._events.update(list => [...list, event]);
  }

  deleteEvent(id: string): void {
    this._events.update(list => list.filter(e => e.id !== id));
  }
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return toDateString(new Date());
}

function offsetDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toDateString(d);
}

const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'ev-1',
    title: 'Утренний стендап',
    type: 'personal',
    date: todayStr(),
    startTime: '08:30',
    endTime: '09:00',
    location: 'Zoom',
    color: 'blue',
  },
  {
    id: 'ev-2',
    title: 'Глубокая работа',
    type: 'personal',
    date: todayStr(),
    startTime: '09:30',
    endTime: '11:30',
    location: 'Зона фокуса',
    color: 'blue',
  },
  {
    id: 'ev-3',
    title: 'Обед',
    type: 'personal',
    date: todayStr(),
    startTime: '12:00',
    endTime: '13:00',
    color: 'green',
  },
  {
    id: 'ev-4',
    title: 'Презентация клиенту',
    type: 'task',
    date: todayStr(),
    startTime: '14:00',
    endTime: '15:30',
    location: 'Переговорная А',
    color: 'blue',
    taskId: 'task-1',
  },
  {
    id: 'ev-5',
    title: 'Разбор почты',
    type: 'personal',
    date: todayStr(),
    startTime: '16:00',
    endTime: '17:00',
    color: 'amber',
  },
  {
    id: 'ev-6',
    title: 'Тренировка',
    type: 'personal',
    date: todayStr(),
    startTime: '18:00',
    endTime: '19:30',
    location: 'PowerFit Lab',
    color: 'rose',
  },
  // Week events on other days
  {
    id: 'ev-7',
    title: 'Синхронизация проекта',
    type: 'task',
    date: offsetDateStr(-1),
    startTime: '09:00',
    endTime: '11:00',
    color: 'blue',
    taskId: 'task-2',
  },
  {
    id: 'ev-8',
    title: 'Обед',
    type: 'personal',
    date: offsetDateStr(-1),
    startTime: '13:00',
    endTime: '14:00',
    color: 'green',
  },
  {
    id: 'ev-9',
    title: 'Ревью дизайна',
    type: 'google',
    date: offsetDateStr(1),
    startTime: '11:00',
    endTime: '13:00',
    color: 'amber',
    googleEventId: 'g-123',
  },
  {
    id: 'ev-10',
    title: 'Маркетинг-митинг',
    type: 'google',
    date: offsetDateStr(2),
    startTime: '09:00',
    endTime: '10:00',
    color: 'purple',
    googleEventId: 'g-456',
  },
  {
    id: 'ev-11',
    title: 'Еженедельная ретро',
    type: 'personal',
    date: offsetDateStr(3),
    startTime: '16:00',
    endTime: '18:00',
    color: 'purple',
  },
  {
    id: 'ev-12',
    title: 'Тренировка',
    type: 'personal',
    date: offsetDateStr(4),
    startTime: '10:00',
    endTime: '11:00',
    color: 'rose',
  },
];
