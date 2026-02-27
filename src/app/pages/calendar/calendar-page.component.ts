import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { CalendarService } from '../../features/calendar/data/calendar.service';
import {
  CalendarViewMode, HOURS, HOUR_HEIGHT, EVENT_COLOR_MAP,
  CalendarEvent, EventCreatePayload, EventLayout,
  timeToMinutes, layoutEvents,
} from '../../features/calendar/models/calendar-event.models';
import { EventCreatePanelComponent } from '../../features/calendar/ui/event-create-panel/event-create-panel.component';

const EVENT_TYPE_LABELS: Record<string, string> = {
  personal: 'Личное',
  task: 'Задача',
  google: 'Google Calendar',
};

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent, CommonModule, EventCreatePanelComponent],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
})
export class CalendarPageComponent implements OnInit {
  protected readonly calendarService = inject(CalendarService);

  readonly title = 'Расписание';
  readonly hours = HOURS;
  readonly colorMap = EVENT_COLOR_MAP;

  readonly selectedEvent = signal<CalendarEvent | null>(null);
  readonly showCreatePanel = signal(false);

  ngOnInit(): void {
    this.calendarService.loadEvents();
    this.calendarService.loadGoogleStatus();
  }

  // Laid-out events for the day view
  readonly dayLayouts = computed<EventLayout[]>(() => {
    return layoutEvents(this.calendarService.eventsForDay());
  });

  readonly headerSubtitle = computed(() => {
    if (this.calendarService.viewMode() === 'day') {
      return this.calendarService.selectedDateLabel();
    }
    return this.calendarService.weekLabel();
  });

  readonly currentTimeOffset = computed(() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 60) * HOUR_HEIGHT;
  });

  setView(mode: CalendarViewMode): void {
    this.calendarService.setViewMode(mode);
  }

  formatHour(h: number): string {
    return `${String(h).padStart(2, '0')}:00`;
  }

  // --- Position helpers (0-based hours) ---

  eventTop(event: CalendarEvent): number {
    const min = timeToMinutes(event.startTime);
    return (min / 60) * HOUR_HEIGHT;
  }

  eventHeight(event: CalendarEvent): number {
    const durationMin = timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
    return Math.max(20, (durationMin / 60) * HOUR_HEIGHT);
  }

  eventDurationMin(event: CalendarEvent): number {
    return timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
  }

  isShortEvent(event: CalendarEvent): boolean {
    return this.eventDurationMin(event) <= 45;
  }

  // --- Overlap layout style helpers ---

  /** Left offset as CSS calc for day view events */
  dayEventLeft(layout: EventLayout): string {
    const pct = (layout.column / layout.totalColumns) * 100;
    return `calc(${pct}% + 4px)`;
  }

  /** Width as CSS calc for day view events */
  dayEventWidth(layout: EventLayout): string {
    const pct = 100 / layout.totalColumns;
    return `calc(${pct}% - 8px)`;
  }

  /** Left offset as CSS calc for week view events */
  weekEventLeft(layout: EventLayout): string {
    const pct = (layout.column / layout.totalColumns) * 100;
    return `calc(${pct}% + 2px)`;
  }

  /** Width as CSS calc for week view events */
  weekEventWidth(layout: EventLayout): string {
    const pct = 100 / layout.totalColumns;
    return `calc(${pct}% - 4px)`;
  }

  /** Layout events for a specific date (used in week view) */
  weekLayoutsForDate(date: Date): EventLayout[] {
    return layoutEvents(this.calendarService.eventsForDate(date));
  }

  // --- Labels ---

  eventTimeLabel(event: CalendarEvent): string {
    return `${event.startTime} — ${event.endTime}`;
  }

  eventTypeLabel(event: CalendarEvent): string {
    return EVENT_TYPE_LABELS[event.type] ?? event.type;
  }

  eventDurationLabel(event: CalendarEvent): string {
    const min = this.eventDurationMin(event);
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h} ч ${m} мин`;
    if (h > 0) return `${h} ч`;
    return `${m} мин`;
  }

  // --- Detail popup ---

  openEventDetail(event: CalendarEvent, e: MouseEvent): void {
    e.stopPropagation();
    this.selectedEvent.set(event);
  }

  closeEventDetail(): void {
    this.selectedEvent.set(null);
  }

  onDetailBackdropClick(): void {
    this.closeEventDetail();
  }

  onDetailCardClick(e: MouseEvent): void {
    e.stopPropagation();
  }

  // --- Create panel ---

  onAddEvent(): void {
    this.showCreatePanel.set(true);
  }

  onSaveEvent(payload: EventCreatePayload): void {
    this.calendarService.addEvent({
      title: payload.title,
      type: payload.type,
      date: payload.date,
      endDate: payload.endDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      location: payload.location || undefined,
      color: payload.color,
    });
    this.showCreatePanel.set(false);
  }

  onCancelCreate(): void {
    this.showCreatePanel.set(false);
  }
}
