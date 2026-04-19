import { Component, HostListener, input, output, signal } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragDrop, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { TaskCardComponent } from '../task-card/task-card.component';
import { ColumnHeaderAction, KanbanColumnVm, TaskCardVm, TaskDropEvent, TaskMenuAction } from '../../models/task.models';

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

  readonly isMobile = signal(
    typeof window !== 'undefined' && window.innerWidth <= 768,
  );

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(window.innerWidth <= 768);
  }
  readonly column = input.required<KanbanColumnVm>();
  readonly allColumns = input<KanbanColumnVm[]>([]);
  readonly menuAction = output<TaskMenuAction>();
  readonly taskDrop = output<TaskDropEvent>();
  readonly headerAction = output<ColumnHeaderAction>();
  readonly cardClick = output<TaskCardVm>();

  onDrop(event: CdkDragDrop<string, string, string>): void {
    this.taskDrop.emit({
      taskId: event.item.data,
      fromColumnId: event.previousContainer.data,
      toColumnId: event.container.data,
      fromIndex: event.previousIndex,
      toIndex: event.currentIndex,
    });
  }

  onHeaderAction(): void {
    const col = this.column();
    this.headerAction.emit({ columnId: col.id, columnType: col.columnType, icon: col.headerActionIcon });
  }
}
