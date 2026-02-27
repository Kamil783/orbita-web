import { Component, input, output } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragDrop, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { TaskCardComponent } from '../task-card/task-card.component';
import { ColumnHeaderAction, KanbanColumnVm, TaskDropEvent, TaskMenuAction, TaskStatus } from '../../models/task.models';

@Component({
  selector: 'app-kanban-column',
  standalone: true,
  imports: [TaskCardComponent, CdkDropList, CdkDrag, CdkDragPlaceholder],
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
  readonly taskDrop = output<TaskDropEvent>();
  readonly headerAction = output<ColumnHeaderAction>();

  onDrop(event: CdkDragDrop<TaskStatus>): void {
    this.taskDrop.emit({
      fromColumnId: event.previousContainer.data,
      toColumnId: event.container.data,
      fromIndex: event.previousIndex,
      toIndex: event.currentIndex,
    });
  }

  onHeaderAction(): void {
    const col = this.column();
    this.headerAction.emit({ columnId: col.id, icon: col.headerActionIcon });
  }
}
