import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TasksService } from '../../data/tasks.service';
import { BacklogTask, TaskPriority } from '../../models/task.models';
import { ModalOverlayComponent } from '../../../../shared/ui/modal-overlay/modal-overlay.component';

@Component({
  selector: 'app-backlog-picker-dialog',
  standalone: true,
  imports: [ModalOverlayComponent],
  templateUrl: './backlog-picker-dialog.component.html',
  styleUrl: './backlog-picker-dialog.component.scss',
})
export class BacklogPickerDialogComponent {
  private readonly tasksService = inject(TasksService);

  readonly targetStatus = input.required<string>();
  readonly close = output<void>();

  readonly searchQuery = signal('');

  readonly tasks = computed(() => {
    const available = this.tasksService.availableBacklogTasks();
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return available;
    return available.filter(t => t.title.toLowerCase().includes(q));
  });

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  priorityClass(priority: TaskPriority): string {
    return `priority--${priority}`;
  }

  addTask(task: BacklogTask): void {
    this.tasksService.addToWeek(task.id, this.targetStatus());
  }
}
