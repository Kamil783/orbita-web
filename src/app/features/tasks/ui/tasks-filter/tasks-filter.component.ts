import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TasksFilterItemVm = {
  id: string;
  name: string;
  avatarUrl?: string;
  isAll?: boolean;
};

@Component({
  selector: 'app-tasks-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tasks-filter.component.html',
  styleUrl: './tasks-filter.component.scss',
})
export class TasksFilterComponent {
  @Input() items: TasksFilterItemVm[] = [];
  @Input() selectedId: string | null = null;

  @Output() selectedIdChange = new EventEmitter<string>();

  select(id: string): void {
    this.selectedId = id;
    this.selectedIdChange.emit(id);
  }

  trackById(_: number, x: TasksFilterItemVm): string {
    return x.id;
  }
}