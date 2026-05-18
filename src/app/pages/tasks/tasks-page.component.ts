import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { KanbanBoardComponent } from '../../features/tasks/ui/kanban-board/kanban-board.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { TasksService } from '../../features/tasks/data/tasks.service';
import { UserService } from '../../features/user/data/user.service';
import { NotificationService } from '../../features/notifications/data/notification.service';
import { TasksFilterComponent } from '../../features/tasks/ui/tasks-filter/tasks-filter.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { TaskCreatePanelComponent } from '../../features/tasks/ui/task-create-panel/task-create-panel.component';
import { BacklogViewComponent } from '../../features/tasks/ui/backlog-view/backlog-view.component';
import { BacklogPickerDialogComponent } from '../../features/tasks/ui/backlog-picker-dialog/backlog-picker-dialog.component';
import { CompletedTasksDialogComponent } from '../../features/tasks/ui/completed-tasks-dialog/completed-tasks-dialog.component';
import { ColumnCreateDialogComponent } from '../../features/tasks/ui/column-create-dialog/column-create-dialog.component';
import { TaskDetailDialogComponent } from '../../features/tasks/ui/task-detail-dialog/task-detail-dialog.component';
import {
  ColumnHeaderAction, RecurringTask, TaskCardVm, TaskCreatePayload,
  TaskDropEvent, TasksTab, TaskMenuAction,
} from '../../features/tasks/models/task.models';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [
    AppShellComponent, KanbanBoardComponent, TopbarComponent,
    TasksFilterComponent, ConfirmDialogComponent, TaskCreatePanelComponent,
    BacklogViewComponent, BacklogPickerDialogComponent, CompletedTasksDialogComponent,
    ColumnCreateDialogComponent, TaskDetailDialogComponent, FormsModule,
  ],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.scss',
})
export class TasksPageComponent implements OnInit {
  private readonly tasksService = inject(TasksService);
  private readonly userService = inject(UserService);
  private readonly notifications = inject(NotificationService);

  readonly title = 'Задачи';
  readonly activeTab = signal<TasksTab>('board');

  readonly filterItems = this.tasksService.filterItems;
  readonly assigneeOptions = this.userService.members;

  ngOnInit(): void {
    this.tasksService.loadCurrentWeek();
    this.tasksService.loadWeeklyBoard();
    this.tasksService.loadBacklog();
    this.tasksService.loadWeekArchives();
    this.tasksService.loadCapacity();
    this.tasksService.loadRecurringTasks();
    this.userService.loadMembers();
  }

  // ─── Recurring tasks popover ───
  @ViewChild('recurringWrap') recurringWrap?: ElementRef<HTMLElement>;

  readonly recurringTasks = this.tasksService.recurringTasks;
  readonly showRecurringPopover = signal(false);
  readonly recurringEditingId = signal<string | null>(null);

  recurringTitleInput = '';
  recurringDescriptionInput = '';
  recurringDayInput = '';

  /** Sorted by due day, then alphabetically for ties. */
  readonly sortedRecurringTasks = computed(() =>
    [...this.recurringTasks()].sort((a, b) => {
      if (a.dayOfMonth !== b.dayOfMonth) return a.dayOfMonth - b.dayOfMonth;
      return a.title.localeCompare(b.title, 'ru');
    }),
  );

  readonly recurringDoneCount = computed(() =>
    this.recurringTasks().filter(t => t.isCompleted).length,
  );

  toggleRecurringPopover(event: MouseEvent): void {
    event.stopPropagation();
    this.showRecurringPopover.update(v => !v);
    if (!this.showRecurringPopover()) {
      this.cancelRecurringEdit();
    }
  }

  closeRecurringPopover(): void {
    this.showRecurringPopover.set(false);
    this.cancelRecurringEdit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClickForRecurring(event: MouseEvent): void {
    if (!this.showRecurringPopover()) return;
    const target = event.target as Node;
    if (this.recurringWrap && !this.recurringWrap.nativeElement.contains(target)) {
      this.closeRecurringPopover();
    }
  }

  private resetRecurringForm(): void {
    this.recurringTitleInput = '';
    this.recurringDescriptionInput = '';
    this.recurringDayInput = '';
  }

  cancelRecurringEdit(): void {
    this.recurringEditingId.set(null);
    this.resetRecurringForm();
  }

  startEditRecurring(task: RecurringTask): void {
    this.recurringEditingId.set(task.id);
    this.recurringTitleInput = task.title;
    this.recurringDescriptionInput = task.description ?? '';
    this.recurringDayInput = task.dayOfMonth.toString();
  }

  submitRecurring(): void {
    const title = String(this.recurringTitleInput ?? '').trim();
    const description = String(this.recurringDescriptionInput ?? '').trim();
    const day = parseInt(String(this.recurringDayInput ?? ''), 10);

    if (!title) return;
    if (!Number.isInteger(day) || day < 1 || day > 31) return;

    const editingId = this.recurringEditingId();

    if (editingId) {
      // On edit, an empty description means "clear" (per API contract).
      this.tasksService.updateRecurringTask(editingId, {
        title,
        dayOfMonth: day,
        description: description || undefined,
        clearDescription: !description,
      });
      this.toast('Дело обновлено', `${title} · ${day}-го числа`);
    } else {
      this.tasksService.createRecurringTask({
        title,
        dayOfMonth: day,
        description: description || undefined,
      });
      this.toast('Дело добавлено', `${title} · ${day}-го числа`);
    }

    this.cancelRecurringEdit();
  }

  toggleRecurringDone(task: RecurringTask): void {
    const next = !task.isCompleted;
    this.tasksService.toggleRecurringTaskCompleted(task.id, next);
  }

  deleteRecurring(id: string, event: MouseEvent): void {
    event.stopPropagation();
    const removed = this.recurringTasks().find(t => t.id === id);
    this.tasksService.deleteRecurringTask(id);
    if (this.recurringEditingId() === id) {
      this.cancelRecurringEdit();
    }
    this.toast('Дело удалено', removed?.title ?? '');
  }

  readonly selectedFilterId = signal('all');

  readonly filteredColumns = computed(() => {
    const all = this.tasksService.columns();
    const filterId = this.selectedFilterId();
    // Enrich each card with estimate/logged-time from the matching backlog
    // task — the API returns these on the backlog endpoint, not on the
    // weekly-board endpoint, so we join on the client.
    const backlog = this.tasksService.backlog();
    const backlogById = new Map(backlog.map(t => [t.id, t]));

    const enrich = (cards: TaskCardVm[]): TaskCardVm[] => cards.map(c => {
      if (c.estimateMinutes != null && c.loggedMinutes != null) return c;
      const bl = c.backlogId ? backlogById.get(c.backlogId) : undefined;
      if (!bl) return c;
      return {
        ...c,
        estimateMinutes: c.estimateMinutes ?? bl.estimateMinutes,
        loggedMinutes: c.loggedMinutes ?? bl.loggedMinutes,
      };
    });

    if (filterId === 'all') {
      return all.map(col => ({ ...col, cards: enrich(col.cards) }));
    }

    return all
      .map(col => ({
        ...col,
        cards: enrich(col.cards.filter(
          card => card.assigneeIds?.map(String).includes(filterId),
        )),
      }))
      .map(col => ({ ...col, totalCount: col.cards.length }));
  });

  readonly showCreatePanel = signal(false);
  readonly deleteTaskId = signal<string | null>(null);
  readonly pickerTargetStatus = signal<string | null>(null);
  readonly showCompletedDialog = signal(false);
  readonly showColumnCreateDialog = signal(false);
  readonly showNewWeekConfirm = signal(false);
  readonly detailCard = signal<TaskCardVm | null>(null);
  readonly weekLabel = this.tasksService.currentWeekLabel;

  setTab(tab: TasksTab): void {
    this.activeTab.set(tab);
  }

  onMenuAction(action: TaskMenuAction): void {
    switch (action.type) {
      case 'delete':
        this.deleteTaskId.set(action.taskId);
        break;
      case 'moveTo': {
        const title = this.findCardTitle(action.taskId);
        const columnTitle = this.findColumnTitle(action.targetColumnId);
        this.tasksService.moveTaskById(action.taskId, action.targetColumnId);
        this.toast('Задача перемещена', columnTitle ? `${title} → ${columnTitle}` : title);
        break;
      }
      case 'edit':
        this.openDetailByTaskId(action.taskId);
        break;
    }
  }

  onCardClick(card: TaskCardVm): void {
    this.detailCard.set(card);
  }

  onCloseDetail(): void {
    this.detailCard.set(null);
  }

  private openDetailByTaskId(taskId: string): void {
    for (const col of this.tasksService.columns()) {
      const card = col.cards.find(c => c.id === taskId);
      if (card) {
        this.detailCard.set(card);
        return;
      }
    }
  }

  onTaskDrop(event: TaskDropEvent): void {
    this.tasksService.moveTask(event.taskId, event.fromColumnId, event.toColumnId, event.fromIndex, event.toIndex);
  }

  onHeaderAction(action: ColumnHeaderAction): void {
    if (action.columnType === 'done') {
      this.showCompletedDialog.set(true);
    } else {
      this.pickerTargetStatus.set(action.columnId);
    }
  }

  onConfirmDelete(): void {
    const taskId = this.deleteTaskId();
    if (taskId) {
      const title = this.findCardTitle(taskId);
      this.tasksService.deleteTask(taskId);
      this.toast('Задача удалена', title);
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
    this.tasksService.createTaskOnBoard({
      title: payload.title,
      priority: payload.priority,
      dueDate: payload.dueDate || undefined,
      description: payload.description || undefined,
      assigneeIds: payload.assigneeIds.length ? payload.assigneeIds : undefined,
      progressPct: payload.trackProgress ? 0 : undefined,
      estimateMinutes: payload.estimateMinutes,
    });
    this.toast('Задача создана', payload.title);
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

  onNewWeek(): void {
    this.showNewWeekConfirm.set(true);
  }

  onConfirmNewWeek(): void {
    this.tasksService.startNewWeek();
    this.toast('Новая неделя начата');
    this.showNewWeekConfirm.set(false);
  }

  onNewColumn(): void {
    this.showColumnCreateDialog.set(true);
  }

  onSaveColumn(title: string): void {
    this.tasksService.createColumn(title);
    this.toast('Колонка создана', title);
    this.showColumnCreateDialog.set(false);
  }

  onCancelColumnCreate(): void {
    this.showColumnCreateDialog.set(false);
  }

  private toast(title: string, message = ''): void {
    this.notifications.showToast({ type: 'task', title, message });
  }

  private findCardTitle(taskId: string): string {
    for (const col of this.tasksService.columns()) {
      const card = col.cards.find(c => c.id === taskId);
      if (card) return card.title;
    }
    return '';
  }

  private findColumnTitle(columnId: string): string {
    return this.tasksService.columns().find(c => c.id === columnId)?.title ?? '';
  }
}
