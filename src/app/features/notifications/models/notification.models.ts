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

/**
 * Notification accent palette.
 *
 * Backgrounds use rgba() with the same hue as the text — that way the icon
 * tint reads correctly against either the light (`#fff`-ish) or dark
 * (`#17212c`-ish) `--surface-panel`. Hard-coded pastel hex values like
 * `#dbeafe` looked fine on the light theme but stuck out as bright patches in
 * dark mode.
 */
export const NOTIFICATION_COLORS: Record<NotificationType, { bg: string; text: string; border: string }> = {
  task:    { bg: 'rgba(59, 130, 246, 0.16)', text: '#3b82f6', border: '#3b82f6' },
  meeting: { bg: 'rgba(168, 85, 247, 0.16)', text: '#a855f7', border: '#a855f7' },
  finance: { bg: 'rgba(234, 179, 8, 0.18)',  text: '#eab308', border: '#eab308' },
  alert:   { bg: 'rgba(239, 68, 68, 0.16)',  text: '#ef4444', border: '#ef4444' },
};
