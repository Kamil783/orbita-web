export type TaskPriority = 'high' | 'medium' | 'low' | 'done';

export interface TaskCardVm {
  id: string;
  title: string;
  dueText?: string;
  progressPct?: number;
  priority: TaskPriority;
  assignees?: string[];
  doneText?: string;
}

export interface KanbanColumnVm {
  id: 'todo' | 'inprogress' | 'done';
  title: string;
  count: number;
  headerActionIcon: string;
  muted?: boolean;
  cards: TaskCardVm[];
}
