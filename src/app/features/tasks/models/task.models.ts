export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'inprogress' | 'done';
export type TasksTab = 'board' | 'backlog';

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
  backlogId?: string;
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

export interface BacklogTask {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate?: string;
  assignees?: TaskAssignee[];
  description?: string;
  inWeek: boolean;
  done: boolean;
}

export interface TasksFilterItemVm {
  id: string;
  name: string;
  avatarUrl?: string;
  isAll?: boolean;
}

export type TaskMenuAction =
  | { type: 'edit'; taskId: string }
  | { type: 'moveTo'; taskId: string; targetStatus: TaskStatus }
  | { type: 'delete'; taskId: string };

export type ColumnHeaderAction = { columnId: TaskStatus; icon: string };

export interface TaskCreatePayload {
  title: string;
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string;
  description: string;
}

export interface AssigneeOption {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface TaskDropEvent {
  fromColumnId: TaskStatus;
  toColumnId: TaskStatus;
  fromIndex: number;
  toIndex: number;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'К выполнению',
  inprogress: 'В процессе',
  done: 'Готово',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};
