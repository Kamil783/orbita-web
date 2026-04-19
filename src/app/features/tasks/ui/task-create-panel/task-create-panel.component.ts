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
  estimate = '';

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

  onSave(): void {
    if (!this.title.trim()) return;

    this.save.emit({
      title: this.title.trim(),
      priority: this.priority(),
      dueDate: this.dueDate,
      assigneeIds: this.assigneeIds(),
      description: this.description.trim(),
      trackProgress: this.trackProgress,
      estimateMinutes: this.parseEstimate(this.estimate),
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

}
