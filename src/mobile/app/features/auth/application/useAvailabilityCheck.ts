import { useEffect, useMemo, useRef, useState } from 'react';

export type AvailabilityStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'invalid'
  | 'error';

export type HelperTone = 'muted' | 'danger' | 'success';

type AvailabilityState = {
  status: AvailabilityStatus;
  message?: string;
};

type UseAvailabilityCheckParams = {
  active: boolean;
  value: string;
  normalize?: (value: string) => string;
  idleMessage?: string;
  invalidMessage?: (value: string) => string | null;
  checkingMessage: string;
  availableMessage: string;
  unavailableMessage: string;
  errorMessage: string;
  checkAvailability: (normalizedValue: string) => Promise<boolean>;
  debounceMs?: number;
  timeoutMs?: number;
};

const DEFAULT_DEBOUNCE_MS = 180;
const DEFAULT_TIMEOUT_MS = 3500;

export function useAvailabilityCheck({
  active,
  value,
  normalize = (current) => current.trim().toLowerCase(),
  idleMessage,
  invalidMessage,
  checkingMessage,
  availableMessage,
  unavailableMessage,
  errorMessage,
  checkAvailability,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseAvailabilityCheckParams) {
  const [availability, setAvailability] = useState<AvailabilityState>({ status: 'idle' });
  const normalizeRef = useRef(normalize);
  const invalidMessageRef = useRef(invalidMessage);
  const checkAvailabilityRef = useRef(checkAvailability);

  normalizeRef.current = normalize;
  invalidMessageRef.current = invalidMessage;
  checkAvailabilityRef.current = checkAvailability;

  useEffect(() => {
    if (!active) {
      setAvailability({ status: 'idle' });
      return;
    }

    const normalizedValue = normalizeRef.current(value);

    if (!normalizedValue) {
      setAvailability({ status: 'idle' });
      return;
    }

    const invalid = invalidMessageRef.current?.(normalizedValue);
    if (invalid) {
      setAvailability({
        status: 'invalid',
        message: invalid,
      });
      return;
    }

    setAvailability({
      status: 'checking',
      message: checkingMessage,
    });

    let cancelled = false;
    let settled = false;
    let requestTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const debounceTimeoutId = setTimeout(() => {
      requestTimeoutId = setTimeout(() => {
        if (cancelled || settled) {
          return;
        }

        settled = true;
        setAvailability({
          status: 'error',
          message: errorMessage,
        });
      }, timeoutMs);

      void checkAvailabilityRef.current(normalizedValue)
        .then((isAvailable) => {
          if (cancelled || settled) {
            return;
          }

          settled = true;
          if (requestTimeoutId) {
            clearTimeout(requestTimeoutId);
          }

          setAvailability({
            status: isAvailable ? 'available' : 'unavailable',
            message: isAvailable ? availableMessage : unavailableMessage,
          });
        })
        .catch(() => {
          if (cancelled || settled) {
            return;
          }

          settled = true;
          if (requestTimeoutId) {
            clearTimeout(requestTimeoutId);
          }

          setAvailability({
            status: 'error',
            message: errorMessage,
          });
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimeoutId);
      if (requestTimeoutId) {
        clearTimeout(requestTimeoutId);
      }
    };
  }, [
    active,
    availableMessage,
    checkingMessage,
    debounceMs,
    errorMessage,
    timeoutMs,
    unavailableMessage,
    value,
  ]);

  const helper = useMemo(
    () => (availability.status === 'idle' ? idleMessage : availability.message),
    [availability, idleMessage],
  );

  const helperTone = useMemo<HelperTone>(() => {
    if (availability.status === 'available') {
      return 'success';
    }

    if (
      availability.status === 'invalid' ||
      availability.status === 'unavailable' ||
      availability.status === 'error'
    ) {
      return 'danger';
    }

    return 'muted';
  }, [availability.status]);

  return {
    availability,
    helper,
    helperTone,
  };
}
