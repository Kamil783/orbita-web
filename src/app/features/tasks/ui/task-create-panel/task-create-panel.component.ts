import { Component, computed, HostListener, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { AvatarPipe } from '../../../../shared/ui/avatar-pipe/avatar.pipe';
import { ModalOverlayComponent } from '../../../../shared/ui/modal-overlay/modal-overlay.component';
import { User } from '../../../user/data/user.service';
import {
  TaskCreatePayload,
  TaskPriority,
} from '../../models/task.models';

@Component({
  selector: 'app-task-create-panel',
  standalone: true,
  imports: [FormsModule, DatePickerComponent, AvatarPipe, ModalOverlayComponent],
  templateUrl: './task-create-panel.component.html',
  styleUrl: './task-create-panel.component.scss',
})
export class TaskCreatePanelComponent {
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.assignee-dropdown')) {
      this.assigneeDropdownOpen.set(false);
    }
  }

  readonly assignees = input<User[]>([]);

  readonly save = output<TaskCreatePayload>();
  readonly cancel = output<void>();

  title = '';
  priority = signal<TaskPriority>('low');
  dueDate = '';
  assigneeIds = signal<string[]>([]);
  description = '';
  trackProgress = false;

  readonly assigneeDropdownOpen = signal(false);

  readonly assigneeDropdownLabel = computed(() => {
    const ids = this.assigneeIds();
    if (!ids.length) return '';
    const users = this.assignees().filter(a => ids.includes(a.id));
    return users.map(u => u.name).join(', ');
  });

  readonly priorities: { value: TaskPriority; label: string }[] = [
    { value: 'low', label: 'Низкий' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' },
    { value: 'critical', label: 'Критичный' },
  ];

  selectPriority(value: TaskPriority): void {
    this.priority.set(value);
  }

  toggleAssignee(id: string): void {
    this.assigneeIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
    );
  }

  isAssigneeSelected(id: string): boolean {
    return this.assigneeIds().includes(id);
  }

  toggleAssigneeDropdown(): void {
    this.assigneeDropdownOpen.update(v => !v);
  }

  onSave(): void {
    if (!this.title.trim()) return;

    this.save.emit({
      title: this.title.trim(),
      priority: this.priority(),
      dueDate: this.dueDate,
      assigneeIds: this.assigneeIds(),
      description: this.description.trim(),
      trackProgress: this.trackProgress,
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

}
