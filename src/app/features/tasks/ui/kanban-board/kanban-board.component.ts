import { Component, input, output } from '@angular/core';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { KanbanColumnComponent } from '../kanban-column/kanban-column.component';
import { KanbanColumnVm, TaskDropEvent, TaskMenuAction } from '../../models/task.models';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [KanbanColumnComponent, CdkDropListGroup],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
})
export class KanbanBoardComponent {
  columns = input.required<KanbanColumnVm[]>();
  readonly menuAction = output<TaskMenuAction>();
  readonly taskDrop = output<TaskDropEvent>();
}
