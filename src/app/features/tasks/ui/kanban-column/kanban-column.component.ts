import { Component, input, output } from '@angular/core';
import { TaskCardComponent } from '../task-card/task-card.component';
import { KanbanColumnVm, TaskMenuAction } from '../../models/task.models';

@Component({
  selector: 'app-kanban-column',
  standalone: true,
  imports: [TaskCardComponent],
  templateUrl: './kanban-column.component.html',
  styleUrl: './kanban-column.component.scss',
  host: {
    '[class.divider]': 'showDivider()',
  },
})
export class KanbanColumnComponent {
  readonly showDivider = input(false);
  readonly column = input.required<KanbanColumnVm>();
  readonly menuAction = output<TaskMenuAction>();
}
