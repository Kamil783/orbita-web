import { Component, input } from '@angular/core';
import { KanbanColumnComponent } from '../kanban-column/kanban-column.component';
import { KanbanColumnVm } from '../../models/task.models';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [KanbanColumnComponent],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
})
export class KanbanBoardComponent {
  columns = input.required<KanbanColumnVm[]>();
}
