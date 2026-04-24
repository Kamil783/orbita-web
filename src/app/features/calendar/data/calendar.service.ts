import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CalendarEvent, CalendarDayInfo, CalendarMonthCell, CalendarViewMode, DAY_NAMES_SHORT } from '../models/calendar-event.models';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/**
 * ════════════════════════ API CONTRACT ════════════════════════
 *
 *  EVENTS CRUD
 *  ───────────
 *  GET    /api/Calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
 *         Returns events whose `date` falls in [from, to] inclusive.
 *         Response: CalendarEvent[] — see model below.
 *
 *  POST   /api/Calendar/events
 *         Request body (EventCreatePayload):
 *           { title: string, type: 'personal' | 'task' | 'google',
 *             color: 'blue'|'green'|'amber'|'purple'|'rose',
 *             date: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD',
 *             startTime: 'HH:mm', endTime: 'HH:mm', location?: string }
 *         Response: CalendarEvent (with server-assigned id).
 *
 *  PUT    /api/Calendar/events/:id
 *         Same body as POST; response is updated CalendarEvent.
 *
 *  DELETE /api/Calendar/events/:id
 *         Response: 204 No Content.
 *
 *  GOOGLE CALENDAR INTEGRATION
 *  ───────────────────────────
 *  GET    /api/Calendar/google/status
 *         Response: { connected: boolean }
 *
 *  GET    /api/Calendar/google/auth-url
 *         Builds the Google OAuth consent URL for the current user
 *         (scope: https://www.googleapis.com/auth/calendar.readonly).
 *         Response: { url: string }
 *
 *  GET    /api/Calendar/google/callback?code=...&state=...
 *         Exchanges `code` for access + refresh tokens, persists them
 *         against the current user, then returns an HTML page that
 *         posts `{ type: 'google-calendar-connected' }` to
 *         `window.opener` and closes itself. Also triggers an initial
 *         event sync.
 *
 *  POST   /api/Calendar/google/sync
 *         Forces a re-pull of the user's Google events into the local
 *         events table (type = 'google').
 *         Response: 204 No Content.
 *
 *  POST   /api/Calendar/google/disconnect
 *         Revokes stored refresh token, deletes googleEventId links,
 *         optionally removes `type: 'google'` rows.
 *         Response: 204 No Content.
 *
 *  CalendarEvent shape:
 *    { id: string,
 *      title: string,
 *      type: 'personal' | 'task' | 'google',
 *      date: 'YYYY-MM-DD',
 *      endDate?: 'YYYY-MM-DD',
 *      startTime: 'HH:mm',
 *      endTime: 'HH:mm',
 *      location?: string,
 *      color: 'blue'|'green'|'amber'|'purple'|'rose',
 *      taskId?: string,       // set when type === 'task'
 *      googleEventId?: string // set when type === 'google'
 *    }
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

  readonly monthLabel = computed(() => {
    const d = this._selectedDate();
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
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

  /** 6×7 grid of days for the month view (anchored on Monday) */
  readonly monthCells = computed<CalendarMonthCell[]>(() => {
    const sel = this._selectedDate();
    const year = sel.getFullYear();
    const month = sel.getMonth();

    // First day of month
    const first = new Date(year, month, 1);
    // Monday-based offset: Mon=0..Sun=6
    const weekday = first.getDay();
    const mondayOffset = (weekday === 0 ? 7 : weekday) - 1;

    // Grid start = Monday of the week containing day 1
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayOffset);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = this._events();

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const check = new Date(date);
      check.setHours(0, 0, 0, 0);
      const dateStr = toDateString(date);
      const dow = date.getDay();

      return {
        date,
        dayNumber: date.getDate(),
        isToday: check.getTime() === today.getTime(),
        isWeekend: dow === 0 || dow === 6,
        isCurrentMonth: date.getMonth() === month,
        events: events
          .filter(e => e.date === dateStr)
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      };
    });
  });

  // ── Load data from API ──

  loadEvents(): void {
    // Load events for a wide window around the selected date
    // (covers day/week/month views with margin for grid edges)
    const d = this._selectedDate();
    const from = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const to = new Date(d.getFullYear(), d.getMonth() + 2, 0);

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
    const mode = this._viewMode();
    if (mode === 'day') {
      d.setDate(d.getDate() - 1);
    } else if (mode === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    this._selectedDate.set(d);
    this.loadEvents();
  }

  goNext(): void {
    const d = new Date(this._selectedDate());
    const mode = this._viewMode();
    if (mode === 'day') {
      d.setDate(d.getDate() + 1);
    } else if (mode === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    this._selectedDate.set(d);
    this.loadEvents();
  }

  // ── Google Calendar integration ──

  /**
   * Initiates Google OAuth via popup window.
   * Backend flow:
   *   1. GET  /api/Calendar/google/auth-url          → { url }
   *      Backend builds Google consent URL with client_id, scope
   *      (https://www.googleapis.com/auth/calendar.readonly), redirect_uri
   *      pointing back to backend callback, and a signed `state`.
   *   2. User authenticates in popup, Google redirects to backend callback:
   *      GET /api/Calendar/google/callback?code=...&state=...
   *      Backend exchanges code for access+refresh token, saves in user
   *      profile, then responds with an HTML page that calls
   *      `window.opener.postMessage({ type: 'google-calendar-connected' }, '*')`
   *      and closes itself.
   *   3. Frontend listens for that postMessage, refreshes status + events.
   */
  connectGoogle(): void {
    this.http.get<{ url: string }>(`${this.apiUrl}/api/Calendar/google/auth-url`).subscribe(res => {
      const popup = window.open(
        res.url,
        'google-calendar-auth',
        'width=520,height=640,menubar=no,toolbar=no,location=no,status=no',
      );
      if (!popup) return;

      const onMessage = (event: MessageEvent) => {
        // Accept only same-origin messages coming from the callback page
        if (event.origin !== window.location.origin && event.origin !== this.apiUrl) return;
        const data = event.data as { type?: string };
        if (data?.type === 'google-calendar-connected') {
          window.removeEventListener('message', onMessage);
          this._googleConnected.set(true);
          this.loadEvents();
        }
      };

      window.addEventListener('message', onMessage);

      // Fallback: poll status every 1.5s if popup closes without postMessage
      const poll = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(poll);
          window.removeEventListener('message', onMessage);
          this.loadGoogleStatus();
        }
      }, 1500);
    });
  }

  disconnectGoogle(): void {
    this.http.post(`${this.apiUrl}/api/Calendar/google/disconnect`, {}).subscribe(() => {
      this._googleConnected.set(false);
      this._events.update(events => events.filter(e => e.type !== 'google'));
    });
  }

  /** Manual sync trigger — refetches Google events into local DB */
  syncGoogle(): void {
    this.http.post(`${this.apiUrl}/api/Calendar/google/sync`, {}).subscribe(() => {
      this.loadEvents();
    });
  }
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
