import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { TaskCardVm } from '../../models/task.models';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [NgClass],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
})
export class TaskCardComponent {
  task = input.required<TaskCardVm>();

  get badgeText(): string {
    switch (this.task().priority) {
      case 'high':   return 'Высокий приоритет';
      case 'medium': return 'Средний';
      case 'low':    return 'Низкий';
    }
  }

  get badgeClass(): string {
    return `badge--${this.task().priority}`;
  }
}
