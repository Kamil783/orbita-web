export type CalendarEventType = 'task' | 'personal' | 'google';

export type CalendarEventColor = 'blue' | 'green' | 'amber' | 'purple' | 'rose';

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string;          // ISO date string 'YYYY-MM-DD' (start date)
  endDate?: string;      // ISO date string 'YYYY-MM-DD' (end date, if multi-day)
  startTime: string;     // 'HH:mm'
  endTime: string;       // 'HH:mm'
  location?: string;
  color: CalendarEventColor;
  taskId?: string;       // linked task id (when type === 'task')
  googleEventId?: string; // Google Calendar event id
}

export type CalendarViewMode = 'day' | 'week';

export interface CalendarDayInfo {
  date: Date;
  dayOfWeek: string;
  dayNumber: number;
  isToday: boolean;
  isWeekend: boolean;
}

export interface EventLayout {
  event: CalendarEvent;
  column: number;
  totalColumns: number;
}

export const EVENT_COLOR_MAP: Record<CalendarEventColor, { bg: string; border: string; text: string; bgHover: string }> = {
  blue:   { bg: 'rgba(37,140,244,0.08)', border: '#258cf4', text: '#258cf4', bgHover: 'rgba(37,140,244,0.15)' },
  green:  { bg: 'rgba(16,185,129,0.08)', border: '#10b981', text: '#059669', bgHover: 'rgba(16,185,129,0.15)' },
  amber:  { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', text: '#b45309', bgHover: 'rgba(245,158,11,0.15)' },
  purple: { bg: 'rgba(139,92,246,0.08)', border: '#8b5cf6', text: '#7c3aed', bgHover: 'rgba(139,92,246,0.15)' },
  rose:   { bg: 'rgba(244,63,94,0.08)',  border: '#f43f5e', text: '#e11d48', bgHover: 'rgba(244,63,94,0.15)' },
};

export interface EventCreatePayload {
  title: string;
  type: CalendarEventType;
  color: CalendarEventColor;
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  location: string;
}

export const HOURS: number[] = Array.from({ length: 24 }, (_, i) => i); // 0..23

export const HOUR_HEIGHT = 64; // px per hour row

export const DAY_NAMES_SHORT: string[] = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Convert 'HH:mm' to total minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Layout overlapping events side-by-side (Google Calendar style).
 * Returns each event with its column index and the total columns in its group.
 */
export function layoutEvents(events: CalendarEvent[]): EventLayout[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    const sa = timeToMinutes(a.startTime);
    const sb = timeToMinutes(b.startTime);
    if (sa !== sb) return sa - sb;
    // longer events first so they get earlier columns
    return timeToMinutes(b.endTime) - timeToMinutes(a.endTime);
  });

  // Assign each event to the first available column
  const columns: { id: string; endMin: number }[][] = [];
  const eventCol = new Map<string, number>();

  for (const ev of sorted) {
    const startMin = timeToMinutes(ev.startTime);
    let placed = false;

    for (let col = 0; col < columns.length; col++) {
      const last = columns[col][columns[col].length - 1];
      if (last.endMin <= startMin) {
        columns[col].push({ id: ev.id, endMin: timeToMinutes(ev.endTime) });
        eventCol.set(ev.id, col);
        placed = true;
        break;
      }
    }

    if (!placed) {
      columns.push([{ id: ev.id, endMin: timeToMinutes(ev.endTime) }]);
      eventCol.set(ev.id, columns.length - 1);
    }
  }

  // For each event, count how many columns overlap with it
  const results: EventLayout[] = [];

  for (const ev of sorted) {
    const col = eventCol.get(ev.id)!;
    const startMin = timeToMinutes(ev.startTime);
    const endMin = timeToMinutes(ev.endTime);

    let maxCol = col;
    for (let c = 0; c < columns.length; c++) {
      for (const entry of columns[c]) {
        const entryEvent = sorted.find(e => e.id === entry.id)!;
        const eStart = timeToMinutes(entryEvent.startTime);
        const eEnd = timeToMinutes(entryEvent.endTime);
        if (eStart < endMin && eEnd > startMin) {
          maxCol = Math.max(maxCol, c);
        }
      }
    }

    results.push({
      event: ev,
      column: col,
      totalColumns: maxCol + 1,
    });
  }

  return results;
}
