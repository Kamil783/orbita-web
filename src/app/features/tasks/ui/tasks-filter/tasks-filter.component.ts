import { Component, input, model } from '@angular/core';
import { TasksFilterItemVm } from '../../models/task.models';

@Component({
  selector: 'app-tasks-filter',
  standalone: true,
  templateUrl: './tasks-filter.component.html',
  styleUrl: './tasks-filter.component.scss',
})
export class TasksFilterComponent {
  readonly items = input<TasksFilterItemVm[]>([]);
  readonly selectedId = model<string | null>(null);

  select(id: string): void {
    this.selectedId.set(id);
  }
}