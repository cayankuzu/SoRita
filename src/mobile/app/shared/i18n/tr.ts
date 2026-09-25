import { navigationTr, notificationsTr } from '@/mobile/app/shared/i18n/trSections';
import { authTr } from '@/mobile/app/shared/i18n/tr/auth';
import { brandTr, commonTr } from '@/mobile/app/shared/i18n/tr/common';
import { cardsTr } from '@/mobile/app/shared/i18n/tr/cards';
import { categoriesTr, moderationTr, systemTr } from '@/mobile/app/shared/i18n/tr/system';
import { exploreTr, homeTr } from '@/mobile/app/shared/i18n/tr/explore';
import { listDetailTr, listEditorTr } from '@/mobile/app/shared/i18n/tr/lists';
import { mapTr } from '@/mobile/app/shared/i18n/tr/map';
import { mediaPickerTr } from '@/mobile/app/shared/i18n/tr/mediaPicker';
import { placeEditorTr } from '@/mobile/app/shared/i18n/tr/placeEditor';
import { profileTr } from '@/mobile/app/shared/i18n/tr/profile';
import { settingsTr, uiCatalogTr } from '@/mobile/app/shared/i18n/tr/settings';

// Every visible string, one file per feature under ./tr; this file only
// puts them together under the keys the app reads (tr.common, tr.auth, ...).
export const tr = {
  common: commonTr,
  navigation: navigationTr,
  brand: brandTr,
  mediaPicker: mediaPickerTr,
  system: systemTr,
  moderation: moderationTr,
  categories: categoriesTr,
  home: homeTr,
  explore: exploreTr,
  profile: profileTr,
  listDetail: listDetailTr,
  listEditor: listEditorTr,
  settings: settingsTr,
  uiCatalog: uiCatalogTr,
  auth: authTr,
  map: mapTr,
  placeEditor: placeEditorTr,
  cards: cardsTr,
  notifications: notificationsTr,
} as const;
