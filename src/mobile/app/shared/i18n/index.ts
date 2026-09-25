import { tr } from '@/mobile/app/shared/i18n/tr';

const localeCatalogs = {
  tr,
} as const;

export type SupportedLocale = keyof typeof localeCatalogs;

const defaultLocale: SupportedLocale = 'tr';

function getLocaleCatalog(locale: SupportedLocale = defaultLocale) {
  return localeCatalogs[locale];
}

export const t = getLocaleCatalog();
