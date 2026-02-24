export type NotificationType = 'task' | 'meeting' | 'finance' | 'alert';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  task: 'assignment_turned_in',
  meeting: 'schedule',
  finance: 'payments',
  alert: 'warning',
};

export const NOTIFICATION_COLORS: Record<NotificationType, { bg: string; text: string; border: string }> = {
  task: { bg: '#dbeafe', text: '#2563eb', border: '#3b82f6' },
  meeting: { bg: '#f3e8ff', text: '#9333ea', border: '#a855f7' },
  finance: { bg: '#fef9c3', text: '#ca8a04', border: '#eab308' },
  alert: { bg: '#fee2e2', text: '#dc2626', border: '#ef4444' },
};
