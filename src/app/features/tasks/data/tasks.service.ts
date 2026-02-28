import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  AssigneeOption, BacklogTask, KanbanColumnVm, TaskCardVm,
  TasksFilterItemVm, TaskStatus,
} from '../models/task.models';

/**
 * API endpoints:
 *
 * GET    /api/Tasks/weekly         → KanbanColumnVm[]        Load weekly board columns with cards
 * POST   /api/Tasks/move           → void                    Body: { taskId, fromColumnId, toColumnId, fromIndex, toIndex }
 * POST   /api/Tasks/move-to        → void                    Body: { taskId, targetStatus }
 * DELETE /api/Tasks/:id            → void                    Delete a task
 *
 * GET    /api/Backlog              → BacklogTask[]           Load all backlog tasks
 * POST   /api/Backlog              → BacklogTask             Create a new backlog task. Body: { title, priority, dueDate?, estimateMinutes?, assignees? }
 * POST   /api/Backlog/:id/to-week  → { kanbanCard }          Add backlog task to weekly board. Body: { targetStatus }
 * POST   /api/Backlog/:id/from-week→ void                    Remove backlog task from weekly board
 * PATCH  /api/Backlog/:id/done     → void                    Body: { done: boolean }
 *
 * GET    /api/Team/members         → AssigneeOption[]        Load team members (id, name, avatar?)
 */

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  readonly members = signal<AssigneeOption[]>([]);

  readonly filterItems = computed<TasksFilterItemVm[]>(() => [
    { id: 'all', name: 'Все', isAll: true },
    ...this.members().map(m => ({ id: m.id, name: m.name, avatar: m.avatar })),
  ]);

  readonly columns = signal<KanbanColumnVm[]>([
    { id: 'todo', title: 'К выполнению', totalCount: 0, headerActionIcon: 'add_circle', cards: [] },
    { id: 'inprogress', title: 'В процессе', totalCount: 0, headerActionIcon: 'add_circle', cards: [] },
    { id: 'done', title: 'Готово', totalCount: 0, headerActionIcon: 'checklist', muted: true, cards: [] },
  ]);
  readonly backlog = signal<BacklogTask[]>([]);

  readonly availableBacklogTasks = computed(() =>
    this.backlog().filter(t => !t.inWeek && !t.done),
  );

  readonly completedBacklogTasks = computed(() =>
    this.backlog().filter(t => t.done),
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

  loadMembers(): void {
    this.http.get<AssigneeOption[]>(`${this.apiUrl}/api/Team/members`).subscribe(members => {
      this.members.set(members);
    });
  }

  // ── Kanban operations ──

  moveTask(fromColumnId: TaskStatus, toColumnId: TaskStatus, fromIndex: number, toIndex: number): void {
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

      if (toColumnId === 'done' && card.backlogId) {
        this.markBacklogDone(card.backlogId);
      }

      return result;
    });

    this.http.post(`${this.apiUrl}/api/Tasks/move`, {
      fromColumnId, toColumnId, fromIndex, toIndex,
    }).subscribe();
  }

  moveTaskById(taskId: string, targetStatus: TaskStatus): void {
    this.columns.update(cols => {
      const result = cols.map(col => ({ ...col, cards: [...col.cards] }));

      let card: TaskCardVm | undefined;
      for (const col of result) {
        const idx = col.cards.findIndex(c => c.id === taskId);
        if (idx !== -1) {
          [card] = col.cards.splice(idx, 1);
          col.totalCount = col.cards.length;
          break;
        }
      }

      if (card) {
        card.status = targetStatus;
        const targetCol = result.find(c => c.id === targetStatus)!;
        targetCol.cards.unshift(card);
        targetCol.totalCount = targetCol.cards.length;

        if (targetStatus === 'done' && card.backlogId) {
          this.markBacklogDone(card.backlogId);
        }
      }

      return result;
    });

    this.http.post(`${this.apiUrl}/api/Tasks/move-to`, { taskId, targetStatus }).subscribe();
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

  addToWeek(backlogTaskId: string, targetStatus: TaskStatus = 'todo'): void {
    const task = this.backlog().find(t => t.id === backlogTaskId);
    if (!task || task.inWeek) return;

    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, inWeek: true } : t)),
    );

    this.http.post<{ kanbanCard: TaskCardVm }>(
      `${this.apiUrl}/api/Backlog/${backlogTaskId}/to-week`,
      { targetStatus },
    ).subscribe(res => {
      this.columns.update(cols =>
        cols.map(col => {
          if (col.id !== targetStatus) return col;
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
    const newDone = !task.done;

    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, done: newDone } : t)),
    );

    this.http.patch(`${this.apiUrl}/api/Backlog/${backlogTaskId}/done`, { done: newDone }).subscribe();
  }

  markBacklogDone(backlogTaskId: string): void {
    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, done: true } : t)),
    );

    this.http.patch(`${this.apiUrl}/api/Backlog/${backlogTaskId}/done`, { done: true }).subscribe();
  }

  addBacklogTask(task: Omit<BacklogTask, 'id' | 'inWeek' | 'done'>): void {
    this.http.post<BacklogTask>(`${this.apiUrl}/api/Backlog`, task).subscribe(created => {
      this.backlog.update(list => [...list, created]);
    });
  }
}
