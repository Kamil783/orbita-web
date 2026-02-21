import { Component, inject } from '@angular/core';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { KanbanBoardComponent } from '../../features/tasks/ui/kanban-board/kanban-board.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { TasksService } from '../../features/tasks/tasks.service';
import { TasksFilterComponent } from '../../features/tasks/ui/tasks-filter/tasks-filter.component';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [AppShellComponent, KanbanBoardComponent, TopbarComponent, TasksFilterComponent],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.scss',
})
export class TasksPageComponent {
  private readonly tasksService = inject(TasksService);

  readonly title = 'Задачи на неделю';
  readonly columns = this.tasksService.getColumns();
  filterItems = [
    { id: 'all', name: 'Все', isAll: true },
    { id: 'alex', name: 'Alex Rivera', avatarUrl: '...' },
    { id: 'sarah', name: 'Sarah Chen', avatarUrl: '...' },
  ];
  selectedFilterId = 'all';

  onQuickAdd(): void {
    console.log('quick add');
  }
}
