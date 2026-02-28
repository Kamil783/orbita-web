import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { AvatarPipe } from '../../../../shared/ui/avatar-pipe/avatar.pipe';
import { TasksService } from '../../data/tasks.service';
import { AssigneeOption, BacklogTask, TaskPriority, PRIORITY_LABELS } from '../../models/task.models';

type BacklogFilter = 'all' | 'week' | 'available';

@Component({
  selector: 'app-backlog-view',
  standalone: true,
  imports: [FormsModule, DatePickerComponent, SelectComponent, AvatarPipe],
  templateUrl: './backlog-view.component.html',
  styleUrl: './backlog-view.component.scss',
})
export class BacklogViewComponent {
  private readonly tasksService = inject(TasksService);

  /** Assignee options from the parent page */
  readonly assigneeOptions = input<AssigneeOption[]>([]);

  readonly filter = signal<BacklogFilter>('all');
  readonly assigneeFilter = signal<string>('all'); // 'all' or assignee id
  readonly searchQuery = signal('');
  readonly showAddForm = signal(false);

  // New task form
  newTitle = '';
  newPriority = signal<TaskPriority>('medium');
  newDueDate = '';
  newAssigneeId = '';
  newEstimate = '';

  readonly priorityLabels = PRIORITY_LABELS;

  readonly assigneeSelectOptions = computed<SelectOption[]>(() =>
    this.assigneeOptions().map(a => ({ value: a.id, label: a.name })),
  );

  readonly estimateOptions: SelectOption[] = [
    { value: '15', label: '15 мин' },
    { value: '30', label: '30 мин' },
    { value: '45', label: '45 мин' },
    { value: '60', label: '1 час' },
    { value: '90', label: '1.5 часа' },
    { value: '120', label: '2 часа' },
    { value: '180', label: '3 часа' },
    { value: '240', label: '4 часа' },
  ];

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
    const af = this.assigneeFilter();
    const q = this.searchQuery().toLowerCase().trim();

    // Exclude done tasks from the main list
    tasks = tasks.filter(t => !t.done);

    if (f === 'week') {
      tasks = tasks.filter(t => t.inWeek);
    } else if (f === 'available') {
      tasks = tasks.filter(t => !t.inWeek);
    }

    // Assignee filter
    if (af !== 'all') {
      tasks = tasks.filter(t => t.assignees?.some(a => a.id === af));
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

  setAssigneeFilter(id: string): void {
    this.assigneeFilter.set(id);
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  priorityClass(priority: TaskPriority): string {
    return `priority--${priority}`;
  }

  formatEstimate(minutes?: number): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}ч ${m}м`;
    if (h > 0) return `${h}ч`;
    return `${m}м`;
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

    const assignee = this.assigneeOptions().find(a => a.id === this.newAssigneeId);
    const estimateMin = this.newEstimate ? parseInt(this.newEstimate, 10) : undefined;

    this.tasksService.addBacklogTask({
      title: this.newTitle.trim(),
      priority: this.newPriority(),
      dueDate: this.newDueDate || undefined,
      estimateMinutes: estimateMin && !isNaN(estimateMin) ? estimateMin : undefined,
      assignees: assignee
        ? [{ id: assignee.id, avatar: assignee.avatar ?? '', name: assignee.name }]
        : undefined,
    });
    this.resetForm();
  }

  onCancelAdd(): void {
    this.resetForm();
  }

  selectPriority(value: TaskPriority): void {
    this.newPriority.set(value);
  }

  private resetForm(): void {
    this.showAddForm.set(false);
    this.newTitle = '';
    this.newPriority.set('medium');
    this.newDueDate = '';
    this.newAssigneeId = '';
    this.newEstimate = '';
  }
}
