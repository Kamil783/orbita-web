import { Injectable } from '@angular/core';
import { KanbanColumnVm } from './models/task.models';

@Injectable({ providedIn: 'root' })
export class TasksService {
  getColumns(): KanbanColumnVm[] {
    return MOCK_COLUMNS;
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
        assignees: [
          {
            avatarUrl:
              'https://lh3.googleusercontent.com/aida-public/AB6AXuDC4CstSZcLmPGnmiu765x3Ty2AHZgX6Zq_BBm1Lkcc29wYVkrXwlZPFtMn8aWFa1_qqZ27M40TR8GNmY4b9TlbrzVW9e-LY9reIQHPd6QPIjIpbnlKF3xUllDSM1rZJzVgCdzSFX8Z_Qjhqlsc3twEgHD9OyzHg8T_cFcR7kN6KOzkL3L0FX4NIw2TMQPAhjK6Ar7KGOuRLVwIAd9VahFX4MhQFEoHTBfuwDZTVYYiL8ba3gG0xG6XvAApuh7tldasRkOLD0E3xTw',
            name: 'Пользователь 1',
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
            avatarUrl:
              'https://lh3.googleusercontent.com/aida-public/AB6AXuBkCC03sWslhhcyDd_60Z1c4g-2nfKse_PoSOLZQSdpwNpme0wZQoDNPN2KCRybHx1FAGG68zWZI34rUNsVll_4wq44WkRjle0X1vzq-SF-ol_mu7LNGgYTnrLqJW8c76TtKy0LEaa-J_YShrWSCsiGP10XdfOt2wHCIjPTMfFiu8xGk4_s1ePBeVsEjB46Ra9PePVb0gh6I5PPqLXnvZv2ra6uIfsIaj_Nc7kwFpNf1GlMUMmnVi4eEaLGAB3hTtxk8EwQ889eE',
            name: 'Пользователь 2',
          },
        ],
      },
      {
        id: '5',
        title: 'Интеграция API для Hub v2',
        status: 'inprogress',
        priority: 'medium',
        deadlineText: 'Сегодня',
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
      },
    ],
  },
];
