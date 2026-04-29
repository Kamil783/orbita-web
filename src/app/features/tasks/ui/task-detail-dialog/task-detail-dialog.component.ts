import { Component, computed, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { AvatarPipe } from '../../../../shared/ui/avatar-pipe/avatar.pipe';
import { ModalOverlayComponent } from '../../../../shared/ui/modal-overlay/modal-overlay.component';
import { User, UserService } from '../../../user/data/user.service';
import { TasksService } from '../../data/tasks.service';
import { TaskCardVm, TaskPriority, BacklogTask, TimeEntry } from '../../models/task.models';

@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [FormsModule, DatePipe, DatePickerComponent, AvatarPipe, ModalOverlayComponent],
  templateUrl: './task-detail-dialog.component.html',
  styleUrl: './task-detail-dialog.component.scss',
})
export class TaskDetailDialogComponent {
  private readonly tasksService = inject(TasksService);
  private readonly userService = inject(UserService);

  readonly card = input.required<TaskCardVm>();
  readonly assigneeOptions = input<User[]>([]);
  readonly close = output<void>();

  // Editable fields
  editTitle = '';
  editDescription = '';
  editPriority = signal<TaskPriority>('medium');
  editDueDate = '';
  editAssigneeIds = signal<string[]>([]);
  editEstimate = '';
  editProgress = signal<number | null>(null);

  readonly assigneeDropdownOpen = signal(false);
  readonly isEditing = signal(false);
  readonly weeksExpanded = signal(false);

  toggleWeeksExpanded(): void {
    this.weeksExpanded.update(v => !v);
  }

  /** "5 недель · 17 марта → 14 апреля" — short summary for collapsed state. */
  weeksSummary(labels: string[]): string {
    const count = labels.length;
    const word = this.pluralWeeks(count);
    if (count === 1) return `${count} ${word} · ${labels[0]}`;
    // Take start of first label + end of last (label format "17 марта — 23 марта")
    const first = labels[0]?.split(/\s*[—-]\s*/)[0] ?? '';
    const lastLabel = labels[labels.length - 1] ?? '';
    const lastParts = lastLabel.split(/\s*[—-]\s*/);
    const last = lastParts[lastParts.length - 1] ?? '';
    return `${count} ${word} · ${first} → ${last}`;
  }

  private pluralWeeks(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'неделя';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'недели';
    return 'недель';
  }

  readonly assigneeDropdownLabel = computed(() => {
    const ids = this.editAssigneeIds();
    if (!ids.length) return '';
    const users = this.assigneeOptions().filter(a => ids.includes(a.id));
    return users.map(u => u.name).join(', ');
  });

  /**
   * Parse Jira-style time string into minutes.
   * Supported: "2ч 30м", "2h 30m", "1д", "1d", "1н", "1w", "90" (plain minutes).
   */
  parseEstimate(input: string): number | undefined {
    const s = input.trim().toLowerCase().replace(',', '.');
    if (!s) return undefined;

    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = parseFloat(s);
      return n > 0 ? Math.round(n) : undefined;
    }

    let total = 0;
    let matched = false;

    const weeks = s.match(/(\d+(?:\.\d+)?)\s*[нw]/);
    if (weeks) { total += parseFloat(weeks[1]) * 5 * 8 * 60; matched = true; }

    const days = s.match(/(\d+(?:\.\d+)?)\s*[дd]/);
    if (days) { total += parseFloat(days[1]) * 8 * 60; matched = true; }

    const hours = s.match(/(\d+(?:\.\d+)?)\s*[чh]/);
    if (hours) { total += parseFloat(hours[1]) * 60; matched = true; }

    const mins = s.match(/(\d+(?:\.\d+)?)\s*[мm]/);
    if (mins) { total += parseFloat(mins[1]); matched = true; }

    return matched && total > 0 ? Math.round(total) : undefined;
  }

  formatEstimate(minutes?: number): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}ч ${m}м`;
    if (h > 0) return `${h}ч`;
    return `${m}м`;
  }

  readonly priorities: { value: TaskPriority; label: string }[] = [
    { value: 'low', label: 'Низкий' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' },
    { value: 'critical', label: 'Критичный' },
  ];

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.assignee-dropdown')) {
      this.assigneeDropdownOpen.set(false);
    }
  }

  get backlogTask(): BacklogTask | undefined {
    const id = this.card().backlogId;
    if (!id) return undefined;
    return this.tasksService.backlog().find(t => t.id === id);
  }

  get assignees(): User[] {
    return this.userService.resolveUsers(this.card().assigneeIds);
  }

  get badgeClass(): string {
    return `badge--${this.card().priority}`;
  }

  get priorityIcon(): string {
    switch (this.card().priority) {
      case 'critical': return 'priority_high';
      case 'high': return 'keyboard_double_arrow_up';
      case 'medium': return 'drag_handle';
      case 'low': return 'keyboard_double_arrow_down';
    }
  }

  get badgeText(): string {
    switch (this.card().priority) {
      case 'critical': return 'Критичный';
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
    }
  }

  startEdit(): void {
    const task = this.backlogTask;
    const c = this.card();
    this.editTitle = task?.title ?? c.title;
    this.editDescription = task?.description ?? '';
    this.editPriority.set(task?.priority ?? c.priority);
    this.editDueDate = task?.dueDate ?? '';
    this.editAssigneeIds.set(c.assigneeIds ? [...c.assigneeIds] : []);
    this.editEstimate = task?.estimateMinutes ? this.formatEstimate(task.estimateMinutes) : '';
    this.editProgress.set(c.progressPct ?? null);
    this.isEditing.set(true);
  }

  saveEdit(): void {
    const backlogId = this.card().backlogId;
    if (!backlogId || !this.editTitle.trim()) return;

    const ids = this.editAssigneeIds();

    this.tasksService.updateBacklogTask(backlogId, {
      title: this.editTitle.trim(),
      description: this.editDescription.trim() || undefined,
      priority: this.editPriority(),
      dueDate: this.editDueDate || undefined,
      estimateMinutes: this.parseEstimate(this.editEstimate),
      assigneeIds: ids,
      progressPct: this.editProgress() ?? undefined,
    });

    this.isEditing.set(false);
    this.close.emit();
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  selectPriority(value: TaskPriority): void {
    this.editPriority.set(value);
  }

  toggleAssignee(id: string): void {
    this.editAssigneeIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
    );
  }

  isAssigneeSelected(id: string): boolean {
    return this.editAssigneeIds().includes(id);
  }

  toggleAssigneeDropdown(): void {
    this.assigneeDropdownOpen.update(v => !v);
  }

  // ── Time logging ──

  readonly showTimeLog = signal(false);
  logTimeInput = '';
  logTimeDesc = '';

  readonly timeEntries = computed(() => {
    const entries = this.backlogTask?.timeEntries ?? [];
    return entries.map(e => ({
      ...e,
      userName: this.userService.resolveUsers([e.userId])[0]?.name ?? 'Неизвестный',
      userAvatar: this.userService.resolveUsers([e.userId])[0]?.avatar,
    }));
  });

  readonly loggedMinutes = computed(() => this.backlogTask?.loggedMinutes ?? 0);

  readonly estimateMinutesNum = computed(() => this.backlogTask?.estimateMinutes ?? 0);

  readonly timeProgress = computed(() => {
    const est = this.estimateMinutesNum();
    const logged = this.loggedMinutes();
    if (!est) return 0;
    return Math.min(100, Math.round((logged / est) * 100));
  });

  formatMinutes(m: number): string {
    if (m < 60) return `${m} мин`;
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return mins > 0 ? `${h} ч ${mins} мин` : `${h} ч`;
  }

  submitTimeLog(): void {
    const raw = this.logTimeInput.trim().replace(',', '.');
    if (!raw) return;

    let minutes: number;
    if (raw.includes('ч') || raw.includes('h')) {
      const hours = parseFloat(raw);
      minutes = Math.round(hours * 60);
    } else {
      minutes = parseFloat(raw);
      // If value is small (< 10), treat as hours
      if (!isNaN(minutes) && minutes > 0 && minutes < 10 && !raw.includes('м') && !raw.includes('m')) {
        minutes = Math.round(minutes * 60);
      }
    }

    if (isNaN(minutes) || minutes <= 0) return;

    const backlogId = this.card().backlogId;
    if (!backlogId) return;

    this.tasksService.logTime(backlogId, minutes, this.logTimeDesc.trim() || undefined);
    this.logTimeInput = '';
    this.logTimeDesc = '';
  }

  deleteTimeEntry(entryId: string): void {
    const backlogId = this.card().backlogId;
    if (!backlogId) return;
    this.tasksService.deleteTimeEntry(backlogId, entryId);
  }

}
