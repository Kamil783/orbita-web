export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'inprogress' | 'done';
export type TasksTab = 'board' | 'backlog';

export interface TaskCardVm {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadlineText?: string;
  completedText?: string;
  progressPct?: number;
  assigneeIds?: string[];
  backlogId?: string;
}

export interface KanbanColumnVm {
  id: string;
  title: string;
  /** Общее число задач на сервере (может не совпадать с cards.length при пагинации) */
  totalCount: number;
  headerActionIcon: string;
  muted?: boolean;
  cards: TaskCardVm[];
}

export interface BacklogTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
  dueDisplayText?: string;
  estimateMinutes?: number;
  estimateDisplayText?: string;
  isCompleted: boolean;
  inWeek: boolean;
  assigneeIds?: string[];
}

export interface TasksFilterItemVm {
  id: string;
  name: string;
  avatar?: string;
  isAll?: boolean;
}

export type TaskMenuAction =
  | { type: 'edit'; taskId: string }
  | { type: 'moveTo'; taskId: string; targetStatus: TaskStatus }
  | { type: 'delete'; taskId: string };

export type ColumnHeaderAction = { columnId: string; icon: string };

export interface TaskCreatePayload {
  title: string;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string;
  description: string;
}

export interface TaskDropEvent {
  fromColumnId: string;
  toColumnId: string;
  fromIndex: number;
  toIndex: number;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'К выполнению',
  inprogress: 'В процессе',
  done: 'Готово',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Критичный',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};
