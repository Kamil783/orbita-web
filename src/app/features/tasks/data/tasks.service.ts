import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { UserService } from '../../user/data/user.service';
import {
  BacklogTask, KanbanColumnVm, TaskCardVm,
  TasksFilterItemVm, WeekArchive,
} from '../models/task.models';

/**
 * API endpoints:
 *
 * GET    /api/Tasks/weekly         → KanbanColumnVm[]        Load weekly board columns with cards (assigneeIds only)
 * POST   /api/Tasks/move           → void                    Body: { taskId, fromColumnId, toColumnId, fromIndex, toIndex }
 * POST   /api/Tasks/move-to        → void                    Body: { taskId, targetStatus }
 * DELETE /api/Tasks/:id            → void                    Delete a task
 *
 * GET    /api/Backlog              → BacklogTask[]           Load all backlog tasks (assigneeIds only)
 * POST   /api/Backlog              → BacklogTask             Create a new backlog task. Body: { title, priority, dueDate?, estimateMinutes?, assignee? }
 * POST   /api/Backlog/:id/to-week  → { kanbanCard }          Add backlog task to weekly board. Body: { targetStatus }
 * POST   /api/Backlog/:id/from-week→ void                    Remove backlog task from weekly board
 * PATCH  /api/Backlog/:id/done     → void                    Body: { done: boolean }
 * PATCH  /api/Backlog/:id          → BacklogTask             Update backlog task. Body: { title?, description?, priority?, dueDate?, estimateMinutes?, assigneeIds? }
 *
 * POST   /api/Columns              → { id }                 Create a new board column. Body: { title }
 */

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);
  private readonly userService = inject(UserService);

  readonly filterItems = computed<TasksFilterItemVm[]>(() => [
    { id: 'all', name: 'Все', isAll: true },
    ...this.userService.members().map(m => ({ id: m.id, name: m.name, avatar: m.avatar })),
  ]);

  readonly columns = signal<KanbanColumnVm[]>([
    { id: 'todo', title: 'К выполнению', totalCount: 0, columnType: 'todo', headerActionIcon: 'add_circle', cards: [] },
    { id: 'inprogress', title: 'В процессе', totalCount: 0, columnType: 'inprogress', headerActionIcon: 'add_circle', cards: [] },
    { id: 'done', title: 'Готово', totalCount: 0, columnType: 'done', headerActionIcon: 'checklist', muted: true, cards: [] },
  ]);
  readonly backlog = signal<BacklogTask[]>([]);
  readonly weekArchives = signal<WeekArchive[]>([]);

  readonly currentWeekStart = signal<string>(TasksService.getMonday(new Date()));
  readonly currentWeekEnd = computed(() => {
    const d = new Date(this.currentWeekStart());
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  });

  readonly currentWeekLabel = computed(() => {
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    };
    return `${fmt(this.currentWeekStart())} — ${fmt(this.currentWeekEnd())}`;
  });

  private static getMonday(d: Date): string {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date.toISOString().slice(0, 10);
  }

  readonly availableBacklogTasks = computed(() =>
    this.backlog().filter(t => !t.inWeek && !t.isCompleted),
  );

  readonly completedBacklogTasks = computed(() =>
    this.backlog().filter(t => t.isCompleted),
  );

  readonly backlogCount = computed(() => this.backlog().length);

  // ── Load data from API ──

  loadWeeklyBoard(): void {
    this.http.get<KanbanColumnVm[]>(`${this.apiUrl}/api/Tasks/weekly`).subscribe(cols => {
      this.columns.set(cols);
    });
  }

  loadBacklog(): void {
    this.http.get<BacklogTask[]>(`${this.apiUrl}/api/Backlog`).subscribe(tasks => {
      this.backlog.set(tasks);
    });
  }

  // ── Kanban operations ──

  moveTask(taskId: string, fromColumnId: string, toColumnId: string, fromIndex: number, toIndex: number): void {
    // Optimistic update
    this.columns.update(cols => {
      const result = cols.map(col => ({ ...col, cards: [...col.cards] }));
      const fromCol = result.find(c => c.id === fromColumnId)!;
      const toCol = result.find(c => c.id === toColumnId)!;

      const [card] = fromCol.cards.splice(fromIndex, 1);
      card.status = toColumnId;
      toCol.cards.splice(toIndex, 0, card);

      fromCol.totalCount = fromCol.cards.length;
      toCol.totalCount = toCol.cards.length;

      if (toCol.columnType === 'done' && card.backlogId) {
        this.markBacklogDone(card.backlogId);
      } else if (fromCol.columnType === 'done' && toCol.columnType !== 'done' && card.backlogId) {
        this.unmarkBacklogDone(card.backlogId);
      }

      return result;
    });

    this.http.post(`${this.apiUrl}/api/Tasks/move`, {
      taskId, fromColumnId, toColumnId, fromIndex, toIndex,
    }).subscribe();
  }

  moveTaskById(taskId: string, targetColumnId: string): void {
    this.columns.update(cols => {
      const result = cols.map(col => ({ ...col, cards: [...col.cards] }));

      let card: TaskCardVm | undefined;
      let fromCol: (typeof result)[0] | undefined;
      for (const col of result) {
        const idx = col.cards.findIndex(c => c.id === taskId);
        if (idx !== -1) {
          fromCol = col;
          [card] = col.cards.splice(idx, 1);
          col.totalCount = col.cards.length;
          break;
        }
      }

      if (card) {
        card.status = targetColumnId;
        const targetCol = result.find(c => c.id === targetColumnId)!;
        targetCol.cards.unshift(card);
        targetCol.totalCount = targetCol.cards.length;

        if (targetCol.columnType === 'done' && card.backlogId) {
          this.markBacklogDone(card.backlogId);
        } else if (fromCol?.columnType === 'done' && targetCol.columnType !== 'done' && card.backlogId) {
          this.unmarkBacklogDone(card.backlogId);
        }
      }

      return result;
    });

    this.http.post(`${this.apiUrl}/api/Tasks/move-to`, { taskId, targetStatus: targetColumnId }).subscribe();
  }

  deleteTask(taskId: string): void {
    this.columns.update(cols =>
      cols.map(col => {
        const filtered = col.cards.filter(c => c.id !== taskId);
        return filtered.length === col.cards.length
          ? col
          : { ...col, cards: filtered, totalCount: filtered.length };
      }),
    );

    this.http.delete(`${this.apiUrl}/api/Tasks/${taskId}`).subscribe();
  }

  // ── Backlog operations ──

  addToWeek(backlogTaskId: string, targetColumnId?: string): void {
    targetColumnId ??= this.columns().find(c => c.columnType === 'todo')?.id ?? this.columns()[0]?.id;
    if (!targetColumnId) return;

    const task = this.backlog().find(t => t.id === backlogTaskId);
    if (!task || task.inWeek) return;

    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, inWeek: true } : t)),
    );

    this.http.post<{ kanbanCard: TaskCardVm }>(
      `${this.apiUrl}/api/Backlog/${backlogTaskId}/to-week`,
      { targetStatus: targetColumnId },
    ).subscribe(res => {
      this.columns.update(cols =>
        cols.map(col => {
          if (col.id !== targetColumnId) return col;
          const cards = [...col.cards, res.kanbanCard];
          return { ...col, cards, totalCount: cards.length };
        }),
      );
    });
  }

  removeFromWeek(backlogTaskId: string): void {
    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, inWeek: false } : t)),
    );
    this.columns.update(cols =>
      cols.map(col => {
        const cards = col.cards.filter(c => c.backlogId !== backlogTaskId);
        return cards.length === col.cards.length
          ? col
          : { ...col, cards, totalCount: cards.length };
      }),
    );

    this.http.post(`${this.apiUrl}/api/Backlog/${backlogTaskId}/from-week`, {}).subscribe();
  }

  toggleBacklogDone(backlogTaskId: string): void {
    const task = this.backlog().find(t => t.id === backlogTaskId);
    if (!task) return;
    const newDone = !task.isCompleted;

    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, isCompleted: newDone } : t)),
    );

    this.http.patch(`${this.apiUrl}/api/Backlog/${backlogTaskId}/done`, { done: newDone }).subscribe();
  }

  markBacklogDone(backlogTaskId: string): void {
    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, isCompleted: true } : t)),
    );

    this.http.patch(`${this.apiUrl}/api/Backlog/${backlogTaskId}/done`, { done: true }).subscribe();
  }

  unmarkBacklogDone(backlogTaskId: string): void {
    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, isCompleted: false } : t)),
    );

    this.http.patch(`${this.apiUrl}/api/Backlog/${backlogTaskId}/done`, { done: false }).subscribe();
  }

  updateBacklogTask(id: string, changes: Partial<Pick<BacklogTask, 'title' | 'description' | 'priority' | 'dueDate' | 'estimateMinutes' | 'assigneeIds' | 'progressPct'>>): void {
    // Optimistic update
    this.backlog.update(list =>
      list.map(t => (t.id === id ? { ...t, ...changes } : t)),
    );

    this.http.patch<BacklogTask>(`${this.apiUrl}/api/Backlog/${id}`, changes).subscribe({
      next: (updated) => {
        this.backlog.update(list =>
          list.map(t => (t.id === id ? updated : t)),
        );
      },
      error: () => {
        // Rollback on error — reload backlog
        this.loadBacklog();
      },
    });
  }

  /** Create a backlog task and immediately add it to the "К выполнению" column on the board */
  createTaskOnBoard(task: Omit<BacklogTask, 'id' | 'inWeek' | 'isCompleted'> & { progressPct?: number }): void {
    const dto = {
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate || null,
      estimateMinutes: task.estimateMinutes || null,
      assignee: task.assigneeIds ?? [],
      description: task.description || null,
      progressPct: task.progressPct ?? null,
    };
    this.http.post<BacklogTask>(`${this.apiUrl}/api/Backlog`, dto).subscribe(created => {
      this.backlog.update(list => [...list, created]);
      // Immediately add to the board
      this.addToWeek(created.id);
    });
  }

  addBacklogTask(task: Omit<BacklogTask, 'id' | 'inWeek' | 'isCompleted'> & { progressPct?: number }): void {
    const dto = {
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate || null,
      estimateMinutes: task.estimateMinutes || null,
      assignee: task.assigneeIds ?? [],
      description: task.description || null,
      progressPct: task.progressPct ?? null,
    };
    this.http.post<BacklogTask>(`${this.apiUrl}/api/Backlog`, dto).subscribe(created => {
      this.backlog.update(list => [...list, created]);
    });
  }

  // ── Week operations ──

  loadWeekArchives(): void {
    this.http.get<WeekArchive[]>(`${this.apiUrl}/api/Weeks/archives`).subscribe(archives => {
      this.weekArchives.set(archives);
    });
  }

  startNewWeek(): void {
    const doneCol = this.columns().find(c => c.columnType === 'done');
    const doneTasks = doneCol?.cards ?? [];
    const completedBacklog = doneTasks
      .filter(c => c.backlogId)
      .map(c => this.backlog().find(t => t.id === c.backlogId))
      .filter((t): t is BacklogTask => !!t);

    const archive: WeekArchive = {
      id: `week-${Date.now()}`,
      label: this.currentWeekLabel(),
      startDate: this.currentWeekStart(),
      endDate: this.currentWeekEnd(),
      tasks: completedBacklog,
    };

    // Add to local archives
    this.weekArchives.update(list => [archive, ...list]);

    // Clear done column cards
    this.columns.update(cols =>
      cols.map(col =>
        col.columnType === 'done'
          ? { ...col, cards: [], totalCount: 0 }
          : col,
      ),
    );

    // Mark completed backlog tasks as not in week
    const doneBacklogIds = new Set(completedBacklog.map(t => t.id));
    this.backlog.update(list =>
      list.map(t => doneBacklogIds.has(t.id) ? { ...t, inWeek: false } : t),
    );

    // Advance week start to next Monday
    const nextMonday = new Date(this.currentWeekStart());
    nextMonday.setDate(nextMonday.getDate() + 7);
    this.currentWeekStart.set(nextMonday.toISOString().slice(0, 10));

    this.http.post(`${this.apiUrl}/api/Weeks/new`, {
      archiveLabel: archive.label,
      startDate: archive.startDate,
      endDate: archive.endDate,
    }).subscribe();
  }

  // ── Column operations ──

  createColumn(title: string): void {
    const tempId = `temp-${Date.now()}`;
    const newColumn: KanbanColumnVm = {
      id: tempId,
      title,
      totalCount: 0,
      columnType: 'custom',
      headerActionIcon: 'add_circle',
      cards: [],
    };

    // Optimistic update
    this.columns.update(cols => [...cols, newColumn]);

    this.http.post<{ id: string }>(`${this.apiUrl}/api/Columns`, { title }).subscribe({
      next: (res) => {
        this.columns.update(cols =>
          cols.map(col => col.id === tempId ? { ...col, id: res.id } : col),
        );
      },
      error: () => {
        // Rollback on failure
        this.columns.update(cols => cols.filter(col => col.id !== tempId));
      },
    });
  }
}
