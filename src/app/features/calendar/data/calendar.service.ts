import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CalendarEvent, CalendarDayInfo, CalendarViewMode, DAY_NAMES_SHORT } from '../models/calendar-event.models';

/**
 * API endpoints:
 *
 * GET    /api/Calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD → CalendarEvent[]   Load events for a date range
 * POST   /api/Calendar/events                                → CalendarEvent     Create event. Body: { title, type, color, date, endDate?, startTime, endTime, location? }
 * PUT    /api/Calendar/events/:id                            → CalendarEvent     Update event
 * DELETE /api/Calendar/events/:id                            → void              Delete event
 *
 * POST   /api/Calendar/google/connect                        → { connected }     Initiate Google Calendar OAuth
 * POST   /api/Calendar/google/disconnect                     → void              Disconnect Google Calendar
 * GET    /api/Calendar/google/status                         → { connected }     Check if Google Calendar is connected
 */

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  private readonly _events = signal<CalendarEvent[]>([]);
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

  // ── Load data from API ──

  loadEvents(): void {
    // Load events for the visible date range (current month ± 1 week)
    const d = this._selectedDate();
    const from = new Date(d);
    from.setDate(from.getDate() - 14);
    const to = new Date(d);
    to.setDate(to.getDate() + 14);

    this.http.get<CalendarEvent[]>(`${this.apiUrl}/api/Calendar/events`, {
      params: { from: toDateString(from), to: toDateString(to) },
    }).subscribe(events => {
      this._events.set(events);
    });
  }

  loadGoogleStatus(): void {
    this.http.get<{ connected: boolean }>(`${this.apiUrl}/api/Calendar/google/status`).subscribe(res => {
      this._googleConnected.set(res.connected);
    });
  }

  // ── Event CRUD ──

  eventsForDate(date: Date): CalendarEvent[] {
    const dateStr = toDateString(date);
    return this._events().filter(e => e.date === dateStr);
  }

  addEvent(event: Omit<CalendarEvent, 'id'>): void {
    this.http.post<CalendarEvent>(`${this.apiUrl}/api/Calendar/events`, event).subscribe(created => {
      this._events.update(list => [...list, created]);
    });
  }

  deleteEvent(id: string): void {
    this._events.update(list => list.filter(e => e.id !== id));
    this.http.delete(`${this.apiUrl}/api/Calendar/events/${id}`).subscribe();
  }

  // ── View navigation ──

  setViewMode(mode: CalendarViewMode): void {
    this._viewMode.set(mode);
  }

  setSelectedDate(date: Date): void {
    this._selectedDate.set(date);
    this.loadEvents();
  }

  goToday(): void {
    this._selectedDate.set(new Date());
    this.loadEvents();
  }

  goPrev(): void {
    const d = new Date(this._selectedDate());
    if (this._viewMode() === 'day') {
      d.setDate(d.getDate() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    this._selectedDate.set(d);
    this.loadEvents();
  }

  goNext(): void {
    const d = new Date(this._selectedDate());
    if (this._viewMode() === 'day') {
      d.setDate(d.getDate() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    this._selectedDate.set(d);
    this.loadEvents();
  }

  // ── Google Calendar integration ──

  connectGoogle(): void {
    this.http.post<{ connected: boolean }>(`${this.apiUrl}/api/Calendar/google/connect`, {}).subscribe(res => {
      this._googleConnected.set(res.connected);
      this.loadEvents();
    });
  }

  disconnectGoogle(): void {
    this.http.post(`${this.apiUrl}/api/Calendar/google/disconnect`, {}).subscribe(() => {
      this._googleConnected.set(false);
      this._events.update(events => events.filter(e => e.type !== 'google'));
    });
  }
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
