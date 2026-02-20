import { Component } from '@angular/core';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { KanbanBoardComponent } from '../../features/tasks/ui/kanban-board/kanban-board.component';
import { KanbanColumnVm } from '../../features/tasks/models/task.models';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [AppShellComponent, KanbanBoardComponent, TopbarComponent],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.scss',
})
export class TasksPageComponent {
  title = 'Задачи на неделю';

  columns: KanbanColumnVm[] = [
    {
      id: 'todo',
      title: 'К выполнению',
      count: 4,
      headerActionIcon: 'add',
      cards: [
        {
          id: '1',
          title: 'Проверить презентацию стратегии на Q4',
          dueText: '24 окт',
          priority: 'high',
          assignees: [
            'https://lh3.googleusercontent.com/aida-public/AB6AXuDC4CstSZcLmPGnmiu765x3Ty2AHZgX6Zq_BBm1Lkcc29wYVkrXwlZPFtMn8aWFa1_qqZ27M40TR8GNmY4b9TlbrzVW9e-LY9reIQHPd6QPIjIpbnlKF3xUllDSM1rZJzVgCdzSFX8Z_Qjhqlsc3twEgHD9OyzHg8T_cFcR7kN6KOzkL3L0FX4NIw2TMQPAhjK6Ar7KGOuRLVwIAd9VahFX4MhQFEoHTBfuwDZTVYYiL8ba3gG0xG6XvAApuh7tldasRkOLD0E3xTw'
          ],
        },
        { id: '2', title: 'Обновить документацию по UI', dueText: 'Завтра', priority: 'medium' },
        { id: '3', title: 'Собрать материалы для кейс-стади', dueText: '28 окт', priority: 'low' },
      ],
    },
    {
      id: 'inprogress',
      title: 'В процессе',
      count: 2,
      headerActionIcon: 'add',
      cards: [
        {
          id: '4',
          title: 'Прототипы мобильного дашборда',
          priority: 'high',
          progressPct: 65,
          dueText: '65% готово',
          assignees: [
            'https://lh3.googleusercontent.com/aida-public/AB6AXuBkCC03sWslhhcyDd_60Z1c4g-2nfKse_PoSOLZQSdpwNpme0wZQoDNPN2KCRybHx1FAGG68zWZI34rUNsVll_4wq44WkRjle0X1vzq-SF-ol_mu7LNGgYTnrLqLqJW8c76TtKy0LEaa-J_YShrWSCsiGP10XdfOt2wHCIjPTMfFiu8xGk4_s1ePBeVsEjB46Ra9PePVb0gh6I5PPqLXnvZv2ra6uIfsIaj_Nc7kwFpNf1GlMUMmnVi4eEaLGAB3hTtxk8EwQ889eE'
          ],
        },
        { id: '5', title: 'Интеграция API для Hub v2', priority: 'medium', dueText: 'Сегодня' },
      ],
    },
    {
      id: 'done',
      title: 'Готово',
      count: 12,
      headerActionIcon: 'playlist_add_check',
      muted: true,
      cards: [
        { id: '6', title: 'Закрыть бюджет на октябрь', priority: 'done', doneText: 'Завершено 20 окт' },
      ],
    },
  ];

  onQuickAdd(): void {
    console.log('quick add');
  }
}
