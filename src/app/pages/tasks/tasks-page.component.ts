import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { KanbanBoardComponent } from '../../features/tasks/ui/kanban-board/kanban-board.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { TasksService } from '../../features/tasks/data/tasks.service';
import { TasksFilterComponent } from '../../features/tasks/ui/tasks-filter/tasks-filter.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { TaskCreatePanelComponent } from '../../features/tasks/ui/task-create-panel/task-create-panel.component';
import { BacklogViewComponent } from '../../features/tasks/ui/backlog-view/backlog-view.component';
import { BacklogPickerDialogComponent } from '../../features/tasks/ui/backlog-picker-dialog/backlog-picker-dialog.component';
import { CompletedTasksDialogComponent } from '../../features/tasks/ui/completed-tasks-dialog/completed-tasks-dialog.component';
import { ColumnCreateDialogComponent } from '../../features/tasks/ui/column-create-dialog/column-create-dialog.component';
import {
  ColumnHeaderAction, TaskCreatePayload,
  TaskDropEvent, TasksTab, TaskMenuAction, TaskStatus,
} from '../../features/tasks/models/task.models';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [
    AppShellComponent, KanbanBoardComponent, TopbarComponent,
    TasksFilterComponent, ConfirmDialogComponent, TaskCreatePanelComponent,
    BacklogViewComponent, BacklogPickerDialogComponent, CompletedTasksDialogComponent,
    ColumnCreateDialogComponent,
  ],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.scss',
})
export class TasksPageComponent implements OnInit {
  private readonly tasksService = inject(TasksService);

  readonly title = 'Задачи';
  readonly activeTab = signal<TasksTab>('board');

  readonly filterItems = this.tasksService.filterItems;
  readonly assigneeOptions = this.tasksService.members;

  ngOnInit(): void {
    this.tasksService.loadWeeklyBoard();
    this.tasksService.loadBacklog();
    this.tasksService.loadMembers();
  }

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

  readonly showCreatePanel = signal(false);
  readonly deleteTaskId = signal<string | null>(null);
  readonly pickerTargetStatus = signal<TaskStatus | null>(null);
  readonly showCompletedDialog = signal(false);
  readonly showColumnCreateDialog = signal(false);

  setTab(tab: TasksTab): void {
    this.activeTab.set(tab);
  }

  onMenuAction(action: TaskMenuAction): void {
    switch (action.type) {
      case 'delete':
        this.deleteTaskId.set(action.taskId);
        break;
      case 'moveTo':
        this.tasksService.moveTaskById(action.taskId, action.targetStatus);
        break;
      default:
        console.log('task menu action:', action);
    }
  }

  onTaskDrop(event: TaskDropEvent): void {
    this.tasksService.moveTask(event.fromColumnId, event.toColumnId, event.fromIndex, event.toIndex);
  }

  onHeaderAction(action: ColumnHeaderAction): void {
    if (action.columnId === 'done') {
      this.showCompletedDialog.set(true);
    } else {
      this.pickerTargetStatus.set(action.columnId as TaskStatus);
    }
  }

  onConfirmDelete(): void {
    const taskId = this.deleteTaskId();
    if (taskId) {
      this.tasksService.deleteTask(taskId);
      this.deleteTaskId.set(null);
    }
  }

  onCancelDelete(): void {
    this.deleteTaskId.set(null);
  }

  onQuickAdd(): void {
    this.showCreatePanel.set(true);
  }

  onSaveTask(payload: TaskCreatePayload): void {
    console.log('save task:', payload);
    this.showCreatePanel.set(false);
  }

  onCancelCreate(): void {
    this.showCreatePanel.set(false);
  }

  onClosePickerDialog(): void {
    this.pickerTargetStatus.set(null);
  }

  onCloseCompletedDialog(): void {
    this.showCompletedDialog.set(false);
  }

  onNewColumn(): void {
    this.showColumnCreateDialog.set(true);
  }

  onSaveColumn(title: string): void {
    this.tasksService.createColumn(title);
    this.showColumnCreateDialog.set(false);
  }

  onCancelColumnCreate(): void {
    this.showColumnCreateDialog.set(false);
  }
}
