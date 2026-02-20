import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskCardVm } from '../../models/task.models';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
})
export class TaskCardComponent {
  @Input({ required: true }) task!: TaskCardVm;

  get badgeText(): string {
    switch (this.task.priority) {
      case 'high': return 'Высокий приоритет';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      case 'done': return 'Готово';
    }
  }

  get badgeClass(): string {
    return `badge--${this.task.priority}`;
  }
}
