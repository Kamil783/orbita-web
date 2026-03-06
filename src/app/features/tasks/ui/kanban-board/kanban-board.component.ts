import { Component, input, output, signal, computed, HostListener } from '@angular/core';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { KanbanColumnComponent } from '../kanban-column/kanban-column.component';
import { ColumnHeaderAction, KanbanColumnVm, TaskDropEvent, TaskMenuAction } from '../../models/task.models';

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
  readonly headerAction = output<ColumnHeaderAction>();
  readonly newColumn = output<void>();

  readonly isMobile = signal(typeof window !== 'undefined' && window.innerWidth <= 768);
  readonly activeColumnIndex = signal(0);

  readonly activeColumn = computed(() => {
    const cols = this.columns();
    const idx = this.activeColumnIndex();
    return cols[idx] ?? cols[0];
  });

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(window.innerWidth <= 768);
  }

  selectColumn(index: number): void {
    this.activeColumnIndex.set(index);
  }
}
