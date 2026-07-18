import { tr } from '@/mobile/app/shared/i18n/tr';

export const localeCatalogs = {
  tr,
} as const;

export type SupportedLocale = keyof typeof localeCatalogs;

export const defaultLocale: SupportedLocale = 'tr';

export function getLocaleCatalog(locale: SupportedLocale = defaultLocale) {
  return localeCatalogs[locale];
}

export const t = getLocaleCatalog();
