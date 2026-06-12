export const LIST_NAME_MAX_LENGTH = 100;
export const LIST_DESCRIPTION_MAX_LENGTH = 300;
export const PLACE_NAME_MAX_LENGTH = 100;
export const PLACE_TITLE_MAX_LENGTH = 100;
export const PLACE_ADDRESS_MAX_LENGTH = 150;
export const PLACE_NOTES_MAX_LENGTH = 300;
export const COMMENT_MAX_LENGTH = 300;
export const MAX_SELECTED_LISTS_PER_PLACE_SAVE = 10;

export function clampTextLength(value: string | undefined | null, maxLength: number) {
  return (value || '').slice(0, maxLength);
}

export function buildCharacterLimitLabel(value: string | undefined | null, maxLength: number) {
  return `${(value || '').length}/${maxLength}`;
}
