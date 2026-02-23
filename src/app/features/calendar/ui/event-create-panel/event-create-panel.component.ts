import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CalendarEventType,
  CalendarEventColor,
  EventCreatePayload,
} from '../../models/calendar-event.models';

@Component({
  selector: 'app-event-create-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './event-create-panel.component.html',
  styleUrl: './event-create-panel.component.scss',
})
export class EventCreatePanelComponent {
  readonly save = output<EventCreatePayload>();
  readonly cancel = output<void>();

  title = '';
  eventType = signal<CalendarEventType>('personal');
  color = signal<CalendarEventColor>('blue');
  date = '';
  startTime = '';
  endTime = '';
  location = '';

  readonly eventTypes: { value: CalendarEventType; label: string }[] = [
    { value: 'personal', label: 'Личное' },
    { value: 'task', label: 'Задача' },
  ];

  readonly colors: { value: CalendarEventColor; label: string; hex: string }[] = [
    { value: 'blue', label: 'Синий', hex: '#258cf4' },
    { value: 'green', label: 'Зелёный', hex: '#10b981' },
    { value: 'amber', label: 'Жёлтый', hex: '#f59e0b' },
    { value: 'purple', label: 'Фиолетовый', hex: '#8b5cf6' },
    { value: 'rose', label: 'Розовый', hex: '#f43f5e' },
  ];

  selectType(value: CalendarEventType): void {
    this.eventType.set(value);
  }

  selectColor(value: CalendarEventColor): void {
    this.color.set(value);
  }

  onSave(): void {
    if (!this.title.trim()) return;
    if (!this.date || !this.startTime || !this.endTime) return;

    this.save.emit({
      title: this.title.trim(),
      type: this.eventType(),
      color: this.color(),
      date: this.date,
      startTime: this.startTime,
      endTime: this.endTime,
      location: this.location.trim(),
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onBackdropClick(): void {
    this.cancel.emit();
  }

  onPanelClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
