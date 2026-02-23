import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { CalendarService } from '../../features/calendar/data/calendar.service';
import { CalendarViewMode, HOURS, EVENT_COLOR_MAP, CalendarEvent } from '../../features/calendar/models/calendar-event.models';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent, CommonModule],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
})
export class CalendarPageComponent {
  protected readonly calendarService = inject(CalendarService);

  readonly title = 'Расписание';
  readonly hours = HOURS;
  readonly colorMap = EVENT_COLOR_MAP;

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

  eventTimeLabel(event: CalendarEvent): string {
    return `${event.startTime} — ${event.endTime}`;
  }

  addEvent(): void {
    console.log('add event');
  }
}
