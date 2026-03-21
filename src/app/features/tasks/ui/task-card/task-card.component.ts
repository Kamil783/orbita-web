import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { AvatarPipe } from '../../../../shared/ui/avatar-pipe/avatar.pipe';
import { User, UserService } from '../../../user/data/user.service';
import {
  KanbanColumnVm,
  TaskCardVm,
  TaskMenuAction,
} from '../../models/task.models';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [NgClass, AvatarPipe],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
})
export class TaskCardComponent {
  private readonly userService = inject(UserService);

  task = input.required<TaskCardVm>();
  allColumns = input<KanbanColumnVm[]>([]);

  readonly menuAction = output<TaskMenuAction>();

  readonly menuOpen = signal(false);

  constructor(private readonly elRef: ElementRef<HTMLElement>) {}

  get assignees(): User[] {
    return this.userService.resolveUsers(this.task().assigneeIds);
  }

  get badgeText(): string {
    switch (this.task().priority) {
      case 'critical': return 'Критичный';
      case 'high':     return 'Высокий приоритет';
      case 'medium':   return 'Средний';
      case 'low':      return 'Низкий';
    }
  }

  get badgeClass(): string {
    return `badge--${this.task().priority}`;
  }

  get isDone(): boolean {
    const col = this.allColumns().find(c => c.id === this.task().status);
    return col?.columnType === 'done';
  }

  get moveTargets(): { columnId: string; label: string }[] {
    const current = this.task().status;
    return this.allColumns()
      .filter(col => col.id !== current)
      .map(col => ({ columnId: col.id, label: col.title }));
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

  onMoveTo(event: MouseEvent, targetColumnId: string): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.menuAction.emit({ type: 'moveTo', taskId: this.task().id, targetColumnId });
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
