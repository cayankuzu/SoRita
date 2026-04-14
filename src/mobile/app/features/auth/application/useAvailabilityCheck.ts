import { useEffect, useMemo, useState } from 'react';

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
};

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
}: UseAvailabilityCheckParams) {
  const [availability, setAvailability] = useState<AvailabilityState>({ status: 'idle' });

  useEffect(() => {
    if (!active) {
      setAvailability({ status: 'idle' });
      return;
    }

    const normalizedValue = normalize(value);

    if (!normalizedValue) {
      setAvailability({ status: 'idle' });
      return;
    }

    const invalid = invalidMessage?.(normalizedValue);
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
    const timeoutId = setTimeout(() => {
      void checkAvailability(normalizedValue)
        .then((isAvailable) => {
          if (cancelled) {
            return;
          }

          setAvailability({
            status: isAvailable ? 'available' : 'unavailable',
            message: isAvailable ? availableMessage : unavailableMessage,
          });
        })
        .catch(() => {
          if (cancelled) {
            return;
          }

          setAvailability({
            status: 'error',
            message: errorMessage,
          });
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    active,
    availableMessage,
    checkAvailability,
    checkingMessage,
    errorMessage,
    invalidMessage,
    normalize,
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
