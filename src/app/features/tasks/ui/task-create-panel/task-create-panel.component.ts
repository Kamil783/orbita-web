import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import {
  AssigneeOption,
  TaskCreatePayload,
  TaskPriority,
} from '../../models/task.models';

@Component({
  selector: 'app-task-create-panel',
  standalone: true,
  imports: [FormsModule, DatePickerComponent, SelectComponent],
  templateUrl: './task-create-panel.component.html',
  styleUrl: './task-create-panel.component.scss',
})
export class TaskCreatePanelComponent {
  readonly assignees = input<AssigneeOption[]>([]);

  readonly assigneeOptions = computed(() =>
    this.assignees().map(a => ({ value: a.id, label: a.name })),
  );

  readonly save = output<TaskCreatePayload>();
  readonly cancel = output<void>();

  title = '';
  priority = signal<TaskPriority>('low');
  dueDate = '';
  assigneeId = '';
  description = '';

  readonly priorities: { value: TaskPriority; label: string }[] = [
    { value: 'low', label: 'Низкий' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' },
  ];

  selectPriority(value: TaskPriority): void {
    this.priority.set(value);
  }

  onSave(): void {
    if (!this.title.trim()) return;

    this.save.emit({
      title: this.title.trim(),
      priority: this.priority(),
      dueDate: this.dueDate,
      assigneeId: this.assigneeId,
      description: this.description.trim(),
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onBackdropClick(): void {
    this.cancel.emit();
  }

  onPanelClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
