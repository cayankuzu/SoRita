export const LIST_NAME_MAX_LENGTH = 100;
export const LIST_DESCRIPTION_MAX_LENGTH = 300;
export const PLACE_NAME_MAX_LENGTH = 100;
export const PLACE_TITLE_MAX_LENGTH = 200;
export const PLACE_ADDRESS_MAX_LENGTH = 150;
export const PLACE_NOTES_MAX_LENGTH = 500;
export const PLACE_MENU_URL_MAX_LENGTH = 2048;
export const COMMENT_MAX_LENGTH = 300;
export const USER_NAME_MAX_LENGTH = 60;
export const USERNAME_MAX_LENGTH = 30;
export const USER_BIO_MAX_LENGTH = 150;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const COMMENT_EDIT_WINDOW_MS = 3 * 60 * 1000;
export const MAX_SELECTED_LISTS_PER_PLACE_SAVE = 1;
const PERSISTED_LINE_BREAK_SENTINEL = '\u2028';

export function normalizeLineBreaks(value: string | undefined | null) {
  return (value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n');
}

export function clampTextLength(value: string | undefined | null, maxLength: number) {
  return (value || '').slice(0, maxLength);
}

export function clampMultilineTextLength(value: string | undefined | null, maxLength: number) {
  return normalizeLineBreaks(value).slice(0, maxLength);
}

export function trimPreservingLineBreaks(value: string | undefined | null) {
  return normalizeLineBreaks(value).trim();
}

export function encodePersistedLineBreaks(value: string | undefined | null) {
  return normalizeLineBreaks(value).replace(/\n/g, PERSISTED_LINE_BREAK_SENTINEL);
}

export function normalizeOptionalMultilineText(value: string | undefined | null) {
  const normalized = trimPreservingLineBreaks(value);
  return normalized || undefined;
}

export function normalizeUserNameInput(value: string | undefined | null) {
  return clampTextLength(value, USER_NAME_MAX_LENGTH);
}

export function normalizeUsernameInput(value: string | undefined | null) {
  return clampTextLength((value || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase(), USERNAME_MAX_LENGTH);
}

export function normalizeUserBioInput(value: string | undefined | null) {
  return clampTextLength(value, USER_BIO_MAX_LENGTH);
}

export function normalizeEmailInput(value: string | undefined | null) {
  return clampTextLength(value, EMAIL_MAX_LENGTH);
}

export function buildCharacterLimitLabel(value: string | undefined | null, maxLength: number) {
  return `${(value || '').length}/${maxLength}`;
}
