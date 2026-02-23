import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { CalendarService } from '../../features/calendar/data/calendar.service';
import { CalendarViewMode, HOURS, EVENT_COLOR_MAP, CalendarEvent, EventCreatePayload } from '../../features/calendar/models/calendar-event.models';
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
export class CalendarPageComponent {
  protected readonly calendarService = inject(CalendarService);

  readonly title = 'Расписание';
  readonly hours = HOURS;
  readonly colorMap = EVENT_COLOR_MAP;

  readonly selectedEvent = signal<CalendarEvent | null>(null);
  readonly showCreatePanel = signal(false);

  readonly headerSubtitle = computed(() => {
    if (this.calendarService.viewMode() === 'day') {
      return this.calendarService.selectedDateLabel();
    }
    return this.calendarService.weekLabel();
  });

  readonly currentTimeOffset = computed(() => {
    const now = new Date();
    const minutes = (now.getHours() - 8) * 60 + now.getMinutes();
    return Math.max(0, minutes);
  });

  readonly showCurrentTimeLine = computed(() => {
    const now = new Date();
    return now.getHours() >= 8 && now.getHours() <= 20;
  });

  setView(mode: CalendarViewMode): void {
    this.calendarService.setViewMode(mode);
  }

  formatHour(h: number): string {
    return `${String(h).padStart(2, '0')}:00`;
  }

  eventTop(event: CalendarEvent): number {
    const [h, m] = event.startTime.split(':').map(Number);
    return (h - 8) * 64 + (m / 60) * 64;
  }

  eventHeight(event: CalendarEvent): number {
    const [sh, sm] = event.startTime.split(':').map(Number);
    const [eh, em] = event.endTime.split(':').map(Number);
    const durationMin = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(24, (durationMin / 60) * 64);
  }

  eventDurationMin(event: CalendarEvent): number {
    const [sh, sm] = event.startTime.split(':').map(Number);
    const [eh, em] = event.endTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  isShortEvent(event: CalendarEvent): boolean {
    return this.eventDurationMin(event) <= 45;
  }

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

  onAddEvent(): void {
    this.showCreatePanel.set(true);
  }

  onSaveEvent(payload: EventCreatePayload): void {
    const id = 'ev-' + Date.now();
    this.calendarService.addEvent({
      id,
      title: payload.title,
      type: payload.type,
      date: payload.date,
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
