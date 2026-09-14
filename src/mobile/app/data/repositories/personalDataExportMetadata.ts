export function hasTruncatedPersonalDataCollection(value: unknown): boolean {
  if (value === true) return true;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(hasTruncatedPersonalDataCollection);
}
