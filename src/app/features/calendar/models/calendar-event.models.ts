export type CalendarEventType = 'task' | 'personal' | 'google';

export type CalendarEventColor = 'blue' | 'green' | 'amber' | 'purple' | 'rose';

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string;          // ISO date string 'YYYY-MM-DD'
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

export const EVENT_COLOR_MAP: Record<CalendarEventColor, { bg: string; border: string; text: string; bgHover: string }> = {
  blue:   { bg: 'rgba(37,140,244,0.08)', border: '#258cf4', text: '#258cf4', bgHover: 'rgba(37,140,244,0.15)' },
  green:  { bg: 'rgba(16,185,129,0.08)', border: '#10b981', text: '#059669', bgHover: 'rgba(16,185,129,0.15)' },
  amber:  { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', text: '#b45309', bgHover: 'rgba(245,158,11,0.15)' },
  purple: { bg: 'rgba(139,92,246,0.08)', border: '#8b5cf6', text: '#7c3aed', bgHover: 'rgba(139,92,246,0.15)' },
  rose:   { bg: 'rgba(244,63,94,0.08)',  border: '#f43f5e', text: '#e11d48', bgHover: 'rgba(244,63,94,0.15)' },
};

export const HOURS: number[] = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20

export const DAY_NAMES_SHORT: string[] = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
