import { Component, computed, inject, output } from '@angular/core';
import { TasksService } from '../../data/tasks.service';
import { TaskPriority } from '../../models/task.models';

@Component({
  selector: 'app-completed-tasks-dialog',
  standalone: true,
  templateUrl: './completed-tasks-dialog.component.html',
  styleUrl: './completed-tasks-dialog.component.scss',
})
export class CompletedTasksDialogComponent {
  private readonly tasksService = inject(TasksService);
  readonly close = output<void>();

  readonly tasks = computed(() => this.tasksService.completedBacklogTasks());
  readonly taskCount = computed(() => this.tasks().length);

  priorityClass(priority: TaskPriority): string {
    return `priority--${priority}`;
  }

  onBackdropClick(): void {
    this.close.emit();
  }

  onDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
