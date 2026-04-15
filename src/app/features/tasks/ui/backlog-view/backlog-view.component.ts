import { Component, computed, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { SelectOption } from '../../../../shared/ui/select/select.component';
import { AvatarPipe } from '../../../../shared/ui/avatar-pipe/avatar.pipe';
import { User, UserService } from '../../../user/data/user.service';
import { TasksService } from '../../data/tasks.service';
import { BacklogTask, TaskPriority, PRIORITY_LABELS, WeekArchive, WeeklyCapacity } from '../../models/task.models';


type BacklogFilter = 'all' | 'week' | 'available';

@Component({
  selector: 'app-backlog-view',
  standalone: true,
  imports: [FormsModule, DatePickerComponent, AvatarPipe],
  templateUrl: './backlog-view.component.html',
  styleUrl: './backlog-view.component.scss',
})
export class BacklogViewComponent {
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.assignee-dropdown')) {
      this.assigneeDropdownOpen.set(false);
      this.editAssigneeDropdownOpen.set(false);
    }
  }

  readonly Math = Math;

  private readonly tasksService = inject(TasksService);
  private readonly userService = inject(UserService);
  private readonly elementRef = inject(ElementRef);

  /** Assignee options from the parent page */
  readonly assigneeOptions = input<User[]>([]);

  readonly filter = signal<BacklogFilter>('all');
  readonly assigneeFilter = signal<string>('all'); // 'all' or assignee id
  readonly searchQuery = signal('');
  readonly showAddForm = signal(false);
  readonly expandedWeekIds = signal<Set<string>>(new Set());

  readonly weekArchives = this.tasksService.weekArchives;

  // ── Capacity ──
  readonly showCapacitySettings = signal(false);
  readonly capacity = this.tasksService.capacity;
  readonly totalCapacityMinutes = this.tasksService.totalCapacityMinutes;
  readonly totalWeekLoadMinutes = this.tasksService.totalWeekLoadMinutes;
  readonly weekLoadByAssignee = this.tasksService.weekLoadByAssignee;

  capacityWeekday = 8;
  capacityWeekend = 0;

  openCapacitySettings(): void {
    const c = this.capacity();
    this.capacityWeekday = c.weekdayHours;
    this.capacityWeekend = c.weekendHours;
    this.showCapacitySettings.update(v => !v);
  }

  saveCapacity(): void {
    this.tasksService.saveCapacity({
      weekdayHours: this.capacityWeekday,
      weekendHours: this.capacityWeekend,
    });
    this.showCapacitySettings.set(false);
  }

  readonly capacityPercent = computed(() => {
    const total = this.totalCapacityMinutes();
    if (!total) return 0;
    return Math.round((this.totalWeekLoadMinutes() / total) * 100);
  });

  readonly freeMinutes = computed(() => {
    return Math.max(0, this.totalCapacityMinutes() - this.totalWeekLoadMinutes());
  });

  formatHours(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}ч ${m}м`;
    if (h > 0) return `${h}ч`;
    return `${m}м`;
  }

  readonly perPersonCapacityMinutes = this.tasksService.perPersonCapacityMinutes;

  assigneeLoad(id: string): number {
    return this.weekLoadByAssignee().get(id) ?? 0;
  }

  assigneeCapacityPercent(id: string): number {
    const cap = this.perPersonCapacityMinutes();
    if (!cap) return 0;
    return Math.round((this.assigneeLoad(id) / cap) * 100);
  }

  // New task form
  newTitle = '';
  newDescription = '';
  newPriority = signal<TaskPriority>('medium');
  newDueDate = '';
  newAssigneeIds = signal<string[]>([]);
  newEstimate = '';
  newTrackProgress = false;

  // Edit task state
  readonly editingTaskId = signal<string | null>(null);
  editTitle = '';
  editDescription = '';
  editPriority = signal<TaskPriority>('medium');
  editDueDate = '';
  editAssigneeIds = signal<string[]>([]);
  editEstimate = '';
  readonly editAssigneeDropdownOpen = signal(false);

  readonly editAssigneeDropdownLabel = computed(() => {
    const ids = this.editAssigneeIds();
    if (!ids.length) return '';
    const users = this.assigneeOptions().filter(a => ids.includes(a.id));
    return users.map(u => u.name).join(', ');
  });

  readonly assigneeDropdownOpen = signal(false);

  readonly assigneeDropdownLabel = computed(() => {
    const ids = this.newAssigneeIds();
    if (!ids.length) return '';
    const users = this.assigneeOptions().filter(a => ids.includes(a.id));
    return users.map(u => u.name).join(', ');
  });

  readonly priorityLabels = PRIORITY_LABELS;

  readonly assigneeSelectOptions = computed<SelectOption[]>(() =>
    this.assigneeOptions().map(a => ({ value: a.id, label: a.name })),
  );

  /**
   * Parse Jira-style time string into minutes.
   * Supported formats: "2ч 30м", "2h 30m", "1д", "1d", "1н", "1w", "90" (plain minutes).
   * Returns undefined if the input is empty or invalid.
   */
  parseEstimate(input: string): number | undefined {
    const s = input.trim().toLowerCase();
    if (!s) return undefined;

    // Plain number → treat as minutes
    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      return n > 0 ? n : undefined;
    }

    let total = 0;
    let matched = false;

    // Weeks: "1н", "1w"
    const weeks = s.match(/(\d+)\s*[нw]/);
    if (weeks) { total += parseInt(weeks[1], 10) * 5 * 8 * 60; matched = true; }

    // Days: "1д", "1d"
    const days = s.match(/(\d+)\s*[дd]/);
    if (days) { total += parseInt(days[1], 10) * 8 * 60; matched = true; }

    // Hours: "2ч", "2h"
    const hours = s.match(/(\d+)\s*[чh]/);
    if (hours) { total += parseInt(hours[1], 10) * 60; matched = true; }

    // Minutes: "30м", "30m"
    const mins = s.match(/(\d+)\s*[мm]/);
    if (mins) { total += parseInt(mins[1], 10); matched = true; }

    return matched && total > 0 ? total : undefined;
  }

  readonly filters: { value: BacklogFilter; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'week', label: 'На неделе' },
    { value: 'available', label: 'Доступные' },
  ];

  readonly priorities: { value: TaskPriority; label: string }[] = [
    { value: 'low', label: 'Низкий' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' },
    { value: 'critical', label: 'Критичный' },
  ];

  readonly filteredTasks = computed(() => {
    let tasks = this.tasksService.backlog();
    const f = this.filter();
    const af = this.assigneeFilter();
    const q = this.searchQuery().toLowerCase().trim();

    // Exclude done tasks from the main list
    tasks = tasks.filter(t => !t.isCompleted);

    if (f === 'week') {
      tasks = tasks.filter(t => t.inWeek);
    } else if (f === 'available') {
      tasks = tasks.filter(t => !t.inWeek);
    }

    // Assignee filter
    if (af !== 'all') {
      tasks = tasks.filter(t => t.assigneeIds?.includes(af));
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

  resolveAssignees(ids?: string[]): User[] {
    return this.userService.resolveUsers(ids);
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

    const ids = this.newAssigneeIds();

    this.tasksService.addBacklogTask({
      title: this.newTitle.trim(),
      description: this.newDescription.trim() || undefined,
      priority: this.newPriority(),
      dueDate: this.newDueDate || undefined,
      estimateMinutes: this.parseEstimate(this.newEstimate),
      assigneeIds: ids.length ? ids : undefined,
      progressPct: this.newTrackProgress ? 0 : undefined,
    });
    this.resetForm();
  }

  onCancelAdd(): void {
    this.resetForm();
  }

  selectPriority(value: TaskPriority): void {
    this.newPriority.set(value);
  }

  toggleAssignee(id: string): void {
    this.newAssigneeIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
    );
  }

  isAssigneeSelected(id: string): boolean {
    return this.newAssigneeIds().includes(id);
  }

  toggleAssigneeDropdown(): void {
    this.assigneeDropdownOpen.update(v => !v);
  }

  // ── Edit task ──

  startEdit(task: BacklogTask): void {
    this.editingTaskId.set(task.id);
    this.editTitle = task.title;
    this.editDescription = task.description ?? '';
    this.editPriority.set(task.priority);
    this.editDueDate = task.dueDate ?? '';
    this.editAssigneeIds.set(task.assigneeIds ? [...task.assigneeIds] : []);
    this.editEstimate = task.estimateMinutes ? this.formatEstimate(task.estimateMinutes) : '';
    this.editAssigneeDropdownOpen.set(false);
  }

  saveEdit(): void {
    const id = this.editingTaskId();
    if (!id || !this.editTitle.trim()) return;

    const ids = this.editAssigneeIds();

    this.tasksService.updateBacklogTask(id, {
      title: this.editTitle.trim(),
      description: this.editDescription.trim() || undefined,
      priority: this.editPriority(),
      dueDate: this.editDueDate || undefined,
      estimateMinutes: this.parseEstimate(this.editEstimate),
      assigneeIds: ids,
    });
    this.cancelEdit();
  }

  cancelEdit(): void {
    this.editingTaskId.set(null);
    this.editAssigneeDropdownOpen.set(false);
  }

  selectEditPriority(value: TaskPriority): void {
    this.editPriority.set(value);
  }

  toggleEditAssignee(id: string): void {
    this.editAssigneeIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
    );
  }

  isEditAssigneeSelected(id: string): boolean {
    return this.editAssigneeIds().includes(id);
  }

  toggleEditAssigneeDropdown(): void {
    this.editAssigneeDropdownOpen.update(v => !v);
  }

  // ── Week archives ──

  toggleWeekExpand(weekId: string): void {
    this.expandedWeekIds.update(set => {
      const next = new Set(set);
      if (next.has(weekId)) {
        next.delete(weekId);
      } else {
        next.add(weekId);
      }
      return next;
    });
  }

  isWeekExpanded(weekId: string): boolean {
    return this.expandedWeekIds().has(weekId);
  }

  private resetForm(): void {
    this.showAddForm.set(false);
    this.assigneeDropdownOpen.set(false);
    this.newTitle = '';
    this.newDescription = '';
    this.newPriority.set('medium');
    this.newDueDate = '';
    this.newAssigneeIds.set([]);
    this.newEstimate = '';
    this.newTrackProgress = false;
  }
}
