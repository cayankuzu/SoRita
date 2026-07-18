import { useEffect, useMemo, useState } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { checkAccountAvailability } from '@/mobile/app/data/repositories/accountAvailability';

const AVAILABILITY_STALE_TIME_MS = 1000 * 60;
const AVAILABILITY_DEBOUNCE_MS = 400;

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

type AvailabilityQueryParams = {
  active: boolean;
  availableMessage: string;
  checkingMessage: string;
  errorMessage: string;
  invalidMessage?: (value: string) => string | null;
  unavailableMessage: string;
  value: string;
};

type UsernameAvailabilityQueryParams = AvailabilityQueryParams & {
  excludeUserId?: string | null;
};

function buildAvailabilityState(
  enabled: boolean,
  isFetching: boolean,
  isError: boolean,
  isAvailable: boolean | undefined,
  messages: Pick<
    AvailabilityQueryParams,
    'availableMessage' | 'checkingMessage' | 'errorMessage' | 'unavailableMessage'
  >,
): AvailabilityState {
  if (!enabled) return { status: 'idle' };
  if (isFetching) return { status: 'checking', message: messages.checkingMessage };
  if (isError || isAvailable == null) return { status: 'error', message: messages.errorMessage };
  return {
    status: isAvailable ? 'available' : 'unavailable',
    message: isAvailable ? messages.availableMessage : messages.unavailableMessage,
  };
}

/**
 * Generic field availability hook. Handles normalization, validation,
 * query execution, and state derivation for any uniqueness-checked field.
 */
function useFieldAvailabilityQuery(opts: {
  active: boolean;
  availableMessage: string;
  checkingMessage: string;
  errorMessage: string;
  invalidMessage?: (value: string) => string | null;
  queryFn: (value: string) => Promise<boolean>;
  queryKey: (value: string) => QueryKey;
  unavailableMessage: string;
  value: string;
}) {
  const normalizedValue = opts.value.trim().toLowerCase();
  const [debouncedValue, setDebouncedValue] = useState(normalizedValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(normalizedValue);
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [normalizedValue]);

  const invalid = normalizedValue ? opts.invalidMessage?.(normalizedValue) ?? null : null;
  const waitingForDebounce = normalizedValue !== debouncedValue;
  const enabled = opts.active && Boolean(debouncedValue) && !invalid && !waitingForDebounce;

  const query = useQuery({
    queryKey: opts.queryKey(debouncedValue),
    queryFn: () => opts.queryFn(debouncedValue),
    enabled,
    staleTime: AVAILABILITY_STALE_TIME_MS,
  });

  const availability = useMemo<AvailabilityState>(() => {
    if (!normalizedValue) return { status: 'idle' };
    if (invalid) return { status: 'invalid', message: invalid };
    if (waitingForDebounce) {
      return { status: 'checking', message: opts.checkingMessage };
    }
    return buildAvailabilityState(enabled, query.isFetching, query.isError, query.data, {
      availableMessage: opts.availableMessage,
      checkingMessage: opts.checkingMessage,
      errorMessage: opts.errorMessage,
      unavailableMessage: opts.unavailableMessage,
    });
  }, [
    enabled,
    invalid,
    waitingForDebounce,
    normalizedValue,
    opts.availableMessage,
    opts.checkingMessage,
    opts.errorMessage,
    opts.unavailableMessage,
    query.data,
    query.isError,
    query.isFetching,
  ]);

  return { availability, normalizedValue, query };
}

export function useUsernameAvailabilityQuery({
  excludeUserId,
  value,
  ...params
}: UsernameAvailabilityQueryParams) {
  return useFieldAvailabilityQuery({
    ...params,
    value,
    queryKey: (debouncedValue) =>
      queryKeys.accountAvailability.username(debouncedValue, excludeUserId),
    queryFn: async (debouncedValue) => {
      const result = await checkAccountAvailability({ username: debouncedValue, excludeUserId });
      return result.usernameAvailable;
    },
  });
}

export function useEmailAvailabilityQuery({ value, ...params }: AvailabilityQueryParams) {
  return useFieldAvailabilityQuery({
    ...params,
    value,
    queryKey: (debouncedValue) => queryKeys.accountAvailability.email(debouncedValue),
    queryFn: async (debouncedValue) => {
      const result = await checkAccountAvailability({ email: debouncedValue });
      return result.emailAvailable;
    },
  });
}
