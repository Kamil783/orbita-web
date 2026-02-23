import { Injectable, computed, signal } from '@angular/core';
import { BacklogTask, KanbanColumnVm, TaskPriority, TaskStatus } from './models/task.models';

const PLACEHOLDER_AVATAR_1 =
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%234f86c6'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EА%3C/text%3E%3C/svg%3E`;

const PLACEHOLDER_AVATAR_2 =
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%23e67e50'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EС%3C/text%3E%3C/svg%3E`;

@Injectable({ providedIn: 'root' })
export class TasksService {
  readonly columns = signal<KanbanColumnVm[]>(MOCK_COLUMNS);
  readonly backlog = signal<BacklogTask[]>(MOCK_BACKLOG);

  /** Backlog tasks that are NOT yet added to the week and NOT done */
  readonly availableBacklogTasks = computed(() =>
    this.backlog().filter(t => !t.inWeek && !t.done),
  );

  /** Completed backlog tasks */
  readonly completedBacklogTasks = computed(() =>
    this.backlog().filter(t => t.done),
  );

  /** Total count of all backlog tasks */
  readonly backlogCount = computed(() => this.backlog().length);

  moveTask(fromColumnId: TaskStatus, toColumnId: TaskStatus, fromIndex: number, toIndex: number): void {
    this.columns.update(cols => {
      const result = cols.map(col => ({ ...col, cards: [...col.cards] }));
      const fromCol = result.find(c => c.id === fromColumnId)!;
      const toCol = result.find(c => c.id === toColumnId)!;

      const [card] = fromCol.cards.splice(fromIndex, 1);
      card.status = toColumnId;
      toCol.cards.splice(toIndex, 0, card);

      fromCol.totalCount = fromCol.cards.length;
      toCol.totalCount = toCol.cards.length;

      // If moved to done, mark linked backlog task as done
      if (toColumnId === 'done' && card.backlogId) {
        this.markBacklogDone(card.backlogId);
      }

      return result;
    });
  }

  moveTaskById(taskId: string, targetStatus: TaskStatus): void {
    this.columns.update(cols => {
      const result = cols.map(col => ({ ...col, cards: [...col.cards] }));

      let card;
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
  }

  /** Add a backlog task to the weekly board (todo column) */
  addToWeek(backlogTaskId: string, targetStatus: TaskStatus = 'todo'): void {
    const task = this.backlog().find(t => t.id === backlogTaskId);
    if (!task || task.inWeek) return;

    // Mark as in-week
    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, inWeek: true } : t)),
    );

    // Add kanban card
    this.columns.update(cols =>
      cols.map(col => {
        if (col.id !== targetStatus) return col;
        const newCard = {
          id: 'wk-' + Date.now() + '-' + backlogTaskId,
          title: task.title,
          status: targetStatus,
          priority: task.priority,
          deadlineText: task.dueDate ?? undefined,
          backlogId: backlogTaskId,
          assignees: task.assignees,
        };
        const cards = [...col.cards, newCard];
        return { ...col, cards, totalCount: cards.length };
      }),
    );
  }

  /** Remove a backlog task from the weekly board */
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
  }

  /** Toggle done state of a backlog task */
  toggleBacklogDone(backlogTaskId: string): void {
    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, done: !t.done } : t)),
    );
  }

  /** Mark a backlog task as done */
  markBacklogDone(backlogTaskId: string): void {
    this.backlog.update(list =>
      list.map(t => (t.id === backlogTaskId ? { ...t, done: true } : t)),
    );
  }

  /** Add a new backlog task */
  addBacklogTask(task: Omit<BacklogTask, 'id' | 'inWeek' | 'done'>): void {
    const newTask: BacklogTask = {
      ...task,
      id: 'bl-' + Date.now(),
      inWeek: false,
      done: false,
    };
    this.backlog.update(list => [...list, newTask]);
  }
}

const MOCK_COLUMNS: KanbanColumnVm[] = [
  {
    id: 'todo',
    title: 'К выполнению',
    totalCount: 4,
    headerActionIcon: 'add',
    cards: [
      {
        id: '1',
        title: 'Проверить презентацию стратегии на Q4',
        status: 'todo',
        priority: 'high',
        deadlineText: '24 окт',
        backlogId: 'bl-1',
        assignees: [
          {
            id: 'alex',
            avatarUrl: PLACEHOLDER_AVATAR_1,
            name: 'Alex Rivera',
          },
        ],
      },
      {
        id: '2',
        title: 'Обновить документацию по UI',
        status: 'todo',
        priority: 'medium',
        deadlineText: 'Завтра',
        backlogId: 'bl-2',
      },
      {
        id: '3',
        title: 'Собрать материалы для кейс-стади',
        status: 'todo',
        priority: 'low',
        deadlineText: '28 окт',
        backlogId: 'bl-3',
        assignees: [
          {
            id: 'sarah',
            avatarUrl: PLACEHOLDER_AVATAR_2,
            name: 'Sarah Chen',
          },
        ],
      },
    ],
  },
  {
    id: 'inprogress',
    title: 'В процессе',
    totalCount: 2,
    headerActionIcon: 'add',
    cards: [
      {
        id: '4',
        title: 'Прототипы мобильного дашборда',
        status: 'inprogress',
        priority: 'high',
        progressPct: 65,
        backlogId: 'bl-4',
        assignees: [
          {
            id: 'sarah',
            avatarUrl: PLACEHOLDER_AVATAR_2,
            name: 'Sarah Chen',
          },
        ],
      },
      {
        id: '5',
        title: 'Интеграция API для Hub v2',
        status: 'inprogress',
        priority: 'medium',
        deadlineText: 'Сегодня',
        backlogId: 'bl-5',
        assignees: [
          {
            id: 'alex',
            avatarUrl: PLACEHOLDER_AVATAR_1,
            name: 'Alex Rivera',
          },
        ],
      },
    ],
  },
  {
    id: 'done',
    title: 'Готово',
    totalCount: 12,
    headerActionIcon: 'playlist_add_check',
    muted: true,
    cards: [
      {
        id: '6',
        title: 'Закрыть бюджет на октябрь',
        status: 'done',
        priority: 'low',
        completedText: 'Завершено 20 окт',
        backlogId: 'bl-6',
        assignees: [
          {
            id: 'alex',
            avatarUrl: PLACEHOLDER_AVATAR_1,
            name: 'Alex Rivera',
          },
        ],
      },
    ],
  },
];

const MOCK_BACKLOG: BacklogTask[] = [
  { id: 'bl-1', title: 'Проверить презентацию стратегии на Q4', priority: 'high', dueDate: '24 окт', inWeek: true, done: false, assignees: [{ id: 'alex', avatarUrl: PLACEHOLDER_AVATAR_1, name: 'Alex Rivera' }] },
  { id: 'bl-2', title: 'Обновить документацию по UI', priority: 'medium', dueDate: 'Завтра', inWeek: true, done: false },
  { id: 'bl-3', title: 'Собрать материалы для кейс-стади', priority: 'low', dueDate: '28 окт', inWeek: true, done: false, assignees: [{ id: 'sarah', avatarUrl: PLACEHOLDER_AVATAR_2, name: 'Sarah Chen' }] },
  { id: 'bl-4', title: 'Прототипы мобильного дашборда', priority: 'high', inWeek: true, done: false, assignees: [{ id: 'sarah', avatarUrl: PLACEHOLDER_AVATAR_2, name: 'Sarah Chen' }] },
  { id: 'bl-5', title: 'Интеграция API для Hub v2', priority: 'medium', dueDate: 'Сегодня', inWeek: true, done: false, assignees: [{ id: 'alex', avatarUrl: PLACEHOLDER_AVATAR_1, name: 'Alex Rivera' }] },
  { id: 'bl-6', title: 'Закрыть бюджет на октябрь', priority: 'low', inWeek: true, done: true, assignees: [{ id: 'alex', avatarUrl: PLACEHOLDER_AVATAR_1, name: 'Alex Rivera' }] },
  { id: 'bl-7', title: 'Подготовить отчёт по продажам за Q3', priority: 'high', dueDate: '30 окт', inWeek: false, done: false },
  { id: 'bl-8', title: 'Настроить CI/CD пайплайн', priority: 'medium', inWeek: false, done: false, assignees: [{ id: 'alex', avatarUrl: PLACEHOLDER_AVATAR_1, name: 'Alex Rivera' }] },
  { id: 'bl-9', title: 'Провести код-ревью фронтенда', priority: 'low', dueDate: '1 ноя', inWeek: false, done: false, assignees: [{ id: 'sarah', avatarUrl: PLACEHOLDER_AVATAR_2, name: 'Sarah Chen' }] },
  { id: 'bl-10', title: 'Обновить зависимости проекта', priority: 'low', inWeek: false, done: false },
  { id: 'bl-11', title: 'Написать тесты для модуля авторизации', priority: 'high', dueDate: '3 ноя', inWeek: false, done: false, assignees: [{ id: 'alex', avatarUrl: PLACEHOLDER_AVATAR_1, name: 'Alex Rivera' }] },
  { id: 'bl-12', title: 'Оптимизировать загрузку изображений', priority: 'medium', inWeek: false, done: false },
  { id: 'bl-13', title: 'Рефакторинг модуля уведомлений', priority: 'low', dueDate: '5 ноя', inWeek: false, done: false },
  { id: 'bl-14', title: 'Добавить экспорт в Excel', priority: 'medium', dueDate: '7 ноя', inWeek: false, done: false, assignees: [{ id: 'sarah', avatarUrl: PLACEHOLDER_AVATAR_2, name: 'Sarah Chen' }] },
  { id: 'bl-15', title: 'Миграция на новый API v3', priority: 'high', inWeek: false, done: true },
  { id: 'bl-16', title: 'Дизайн страницы настроек', priority: 'medium', inWeek: false, done: true, assignees: [{ id: 'sarah', avatarUrl: PLACEHOLDER_AVATAR_2, name: 'Sarah Chen' }] },
  { id: 'bl-17', title: 'Исправить баг с логином через Google', priority: 'high', dueDate: '2 ноя', inWeek: false, done: true },
];
