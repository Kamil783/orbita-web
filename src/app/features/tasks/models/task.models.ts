export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'inprogress' | 'done';

export interface TaskAssignee {
  id: string;
  avatarUrl: string;
  name?: string;
}

export interface TaskCardVm {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadlineText?: string;
  completedText?: string;
  progressPct?: number;
  assignees?: TaskAssignee[];
}

export interface KanbanColumnVm {
  id: TaskStatus;
  title: string;
  /** Общее число задач на сервере (может не совпадать с cards.length при пагинации) */
  totalCount: number;
  headerActionIcon: string;
  muted?: boolean;
  cards: TaskCardVm[];
}

export interface TasksFilterItemVm {
  id: string;
  name: string;
  avatarUrl?: string;
  isAll?: boolean;
}
