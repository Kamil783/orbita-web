import { Injectable, signal } from '@angular/core';
import { KanbanColumnVm } from './models/task.models';

const PLACEHOLDER_AVATAR_1 =
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%234f86c6'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EА%3C/text%3E%3C/svg%3E`;

const PLACEHOLDER_AVATAR_2 =
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%23e67e50'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EС%3C/text%3E%3C/svg%3E`;

@Injectable({ providedIn: 'root' })
export class TasksService {
  readonly columns = signal<KanbanColumnVm[]>(MOCK_COLUMNS);
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
      },
      {
        id: '3',
        title: 'Собрать материалы для кейс-стади',
        status: 'todo',
        priority: 'low',
        deadlineText: '28 окт',
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
