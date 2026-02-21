import { Component, ElementRef, HostListener, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import {
  TaskCardVm,
  TaskMenuAction,
  TaskStatus,
  TASK_STATUS_LABELS,
} from '../../models/task.models';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [NgClass],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
})
export class TaskCardComponent {
  task = input.required<TaskCardVm>();

  readonly menuAction = output<TaskMenuAction>();

  readonly menuOpen = signal(false);

  constructor(private readonly elRef: ElementRef<HTMLElement>) {}

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

  get moveTargets(): { status: TaskStatus; label: string }[] {
    const current = this.task().status;
    return (['todo', 'inprogress', 'done'] as TaskStatus[])
      .filter(s => s !== current)
      .map(s => ({ status: s, label: TASK_STATUS_LABELS[s] }));
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update(v => !v);
  }

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.menuAction.emit({ type: 'edit', taskId: this.task().id });
  }

  onMoveTo(event: MouseEvent, targetStatus: TaskStatus): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.menuAction.emit({ type: 'moveTo', taskId: this.task().id, targetStatus });
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.menuAction.emit({ type: 'delete', taskId: this.task().id });
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (this.menuOpen() && !this.elRef.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }
}
