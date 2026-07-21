import { tr } from '@/mobile/app/shared/i18n/tr';

export const notificationUiConfig = {
  title: tr.notifications.title,
  newCount: tr.notifications.newCount,
  categories: tr.notifications.categories,
  emptyTitle: tr.notifications.emptyTitle,
  emptyDescription: tr.notifications.emptyDescription,
  errorTitle: tr.notifications.errorTitle,
  markAllReadLabel: 'Tümünü okundu yap',
  markAllReadShortLabel: 'Tümünü oku',
  partialTitle: tr.notifications.partialTitle,
  partialDescription: tr.notifications.partialDescription,
  toast: tr.notifications.toast,
} as const;
