// The state of a uniqueness check and how it reads under a field. Kept free of
// the query and network imports so pure helpers and their tests can use it.

export type AvailabilityStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'invalid'
  | 'error';

export type AvailabilityState = {
  status: AvailabilityStatus;
  message?: string;
};

export type AvailabilityTone = 'muted' | 'danger' | 'success';

/** The helper line under a checked field: its idle hint, or what the check said. */
export function availabilityHelperText(availability: AvailabilityState, idleMessage?: string) {
  return availability.status === 'idle' ? idleMessage : availability.message;
}

export function availabilityHelperTone(availability: AvailabilityState): AvailabilityTone {
  if (availability.status === 'available') return 'success';
  if (
    availability.status === 'invalid' ||
    availability.status === 'unavailable' ||
    availability.status === 'error'
  ) {
    return 'danger';
  }
  return 'muted';
}
