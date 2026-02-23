import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TasksService } from '../../tasks.service';
import { BacklogTask, TaskPriority, PRIORITY_LABELS } from '../../models/task.models';

type BacklogFilter = 'all' | 'week' | 'available';

@Component({
  selector: 'app-backlog-view',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './backlog-view.component.html',
  styleUrl: './backlog-view.component.scss',
})
export class BacklogViewComponent {
  private readonly tasksService = inject(TasksService);

  readonly filter = signal<BacklogFilter>('all');
  readonly searchQuery = signal('');
  readonly showAddForm = signal(false);

  // New task form
  newTitle = '';
  newPriority = signal<TaskPriority>('medium');
  newDueDate = '';

  readonly priorityLabels = PRIORITY_LABELS;

  readonly filters: { value: BacklogFilter; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'week', label: 'На неделе' },
    { value: 'available', label: 'Доступные' },
  ];

  readonly priorities: { value: TaskPriority; label: string }[] = [
    { value: 'low', label: 'Низкий' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' },
  ];

  readonly filteredTasks = computed(() => {
    let tasks = this.tasksService.backlog();
    const f = this.filter();
    const q = this.searchQuery().toLowerCase().trim();

    // Exclude done tasks from the main list
    tasks = tasks.filter(t => !t.done);

    if (f === 'week') {
      tasks = tasks.filter(t => t.inWeek);
    } else if (f === 'available') {
      tasks = tasks.filter(t => !t.inWeek);
    }

    if (q) {
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q));
    }

    return tasks;
  });

  readonly taskCount = computed(() => this.filteredTasks().length);

  setFilter(value: BacklogFilter): void {
    this.filter.set(value);
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  priorityClass(priority: TaskPriority): string {
    return `priority--${priority}`;
  }

  toggleWeek(task: BacklogTask): void {
    if (task.inWeek) {
      this.tasksService.removeFromWeek(task.id);
    } else {
      this.tasksService.addToWeek(task.id);
    }
  }

  onAddTask(): void {
    this.showAddForm.set(true);
  }

  onSaveNewTask(): void {
    if (!this.newTitle.trim()) return;
    this.tasksService.addBacklogTask({
      title: this.newTitle.trim(),
      priority: this.newPriority(),
      dueDate: this.newDueDate || undefined,
    });
    this.newTitle = '';
    this.newPriority.set('medium');
    this.newDueDate = '';
    this.showAddForm.set(false);
  }

  onCancelAdd(): void {
    this.showAddForm.set(false);
    this.newTitle = '';
    this.newPriority.set('medium');
    this.newDueDate = '';
  }

  selectPriority(value: TaskPriority): void {
    this.newPriority.set(value);
  }
}
