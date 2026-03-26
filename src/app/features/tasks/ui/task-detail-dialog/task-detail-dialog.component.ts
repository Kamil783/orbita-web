import { Component, computed, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { AvatarPipe } from '../../../../shared/ui/avatar-pipe/avatar.pipe';
import { User, UserService } from '../../../user/data/user.service';
import { TasksService } from '../../data/tasks.service';
import { TaskCardVm, TaskPriority, BacklogTask } from '../../models/task.models';

@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [FormsModule, DatePickerComponent, SelectComponent, AvatarPipe],
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

  readonly assigneeDropdownLabel = computed(() => {
    const ids = this.editAssigneeIds();
    if (!ids.length) return '';
    const users = this.assigneeOptions().filter(a => ids.includes(a.id));
    return users.map(u => u.name).join(', ');
  });

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
    this.editEstimate = task?.estimateMinutes ? String(task.estimateMinutes) : '';
    this.editProgress.set(c.progressPct ?? null);
    this.isEditing.set(true);
  }

  saveEdit(): void {
    const backlogId = this.card().backlogId;
    if (!backlogId || !this.editTitle.trim()) return;

    const estimateMin = this.editEstimate ? parseInt(this.editEstimate, 10) : undefined;
    const ids = this.editAssigneeIds();

    this.tasksService.updateBacklogTask(backlogId, {
      title: this.editTitle.trim(),
      description: this.editDescription.trim() || undefined,
      priority: this.editPriority(),
      dueDate: this.editDueDate || undefined,
      estimateMinutes: estimateMin && !isNaN(estimateMin) ? estimateMin : undefined,
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

  onBackdropClick(): void {
    this.close.emit();
  }

  onDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
