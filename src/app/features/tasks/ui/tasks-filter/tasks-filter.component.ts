import { Component, input, model } from '@angular/core';
import { AvatarPipe } from '../../../../shared/ui/avatar-pipe/avatar.pipe';
import { TasksFilterItemVm } from '../../models/task.models';

@Component({
  selector: 'app-tasks-filter',
  standalone: true,
  imports: [AvatarPipe],
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