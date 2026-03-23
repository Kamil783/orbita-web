export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'inprogress' | 'done';
export type TasksTab = 'board' | 'backlog';

export interface TaskCardVm {
  id: string;
  title: string;
  /** Column ID the card belongs to (e.g. 'todo', 'inprogress', 'done', or a custom column ID) */
  status: string;
  priority: TaskPriority;
  deadlineText?: string;
  completedText?: string;
  progressPct?: number;
  assigneeIds?: string[];
  backlogId?: string;
}

/** Роль колонки на доске. Дефолтные три — всегда присутствуют, custom — пользовательские */
export type ColumnType = 'todo' | 'inprogress' | 'done' | 'custom';

export interface KanbanColumnVm {
  id: string;
  title: string;
  /** Общее число задач на сервере (может не совпадать с cards.length при пагинации) */
  totalCount: number;
  columnType: ColumnType;
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
  | { type: 'moveTo'; taskId: string; targetColumnId: string }
  | { type: 'delete'; taskId: string };

export type ColumnHeaderAction = { columnId: string; columnType: ColumnType; icon: string };

export interface TaskCreatePayload {
  title: string;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string;
  description: string;
  trackProgress: boolean;
}

export interface TaskDropEvent {
  taskId: string;
  fromColumnId: string;
  toColumnId: string;
  fromIndex: number;
  toIndex: number;
}

export interface WeekArchive {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  tasks: BacklogTask[];
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
