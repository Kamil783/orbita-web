import { Component, computed, inject, signal } from '@angular/core';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { KanbanBoardComponent } from '../../features/tasks/ui/kanban-board/kanban-board.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { TasksService } from '../../features/tasks/tasks.service';
import { TasksFilterComponent } from '../../features/tasks/ui/tasks-filter/tasks-filter.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { TasksFilterItemVm, TaskMenuAction } from '../../features/tasks/models/task.models';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [AppShellComponent, KanbanBoardComponent, TopbarComponent, TasksFilterComponent, ConfirmDialogComponent],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.scss',
})
export class TasksPageComponent {
  private readonly tasksService = inject(TasksService);

  readonly title = 'Задачи на неделю';

  readonly filterItems: TasksFilterItemVm[] = [
    { id: 'all', name: 'Все', isAll: true },
    {
      id: 'alex',
      name: 'Alex Rivera',
      avatarUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%234f86c6'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EА%3C/text%3E%3C/svg%3E`,
    },
    {
      id: 'sarah',
      name: 'Sarah Chen',
      avatarUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%23e67e50'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EС%3C/text%3E%3C/svg%3E`,
    },
  ];

  readonly selectedFilterId = signal('all');

  readonly filteredColumns = computed(() => {
    const all = this.tasksService.columns();
    const filterId = this.selectedFilterId();

    if (filterId === 'all') {
      return all;
    }

    return all
      .map(col => ({
        ...col,
        cards: col.cards.filter(
          card => card.assignees?.some(a => a.id === filterId),
        ),
      }))
      .map(col => ({ ...col, totalCount: col.cards.length }));
  });

  readonly deleteTaskId = signal<string | null>(null);

  onMenuAction(action: TaskMenuAction): void {
    switch (action.type) {
      case 'delete':
        this.deleteTaskId.set(action.taskId);
        break;
      default:
        console.log('task menu action:', action);
    }
  }

  onConfirmDelete(): void {
    const taskId = this.deleteTaskId();
    if (taskId) {
      console.log('confirmed delete task:', taskId);
      this.deleteTaskId.set(null);
    }
  }

  onCancelDelete(): void {
    this.deleteTaskId.set(null);
  }

  onQuickAdd(): void {
    console.log('quick add');
  }
}
