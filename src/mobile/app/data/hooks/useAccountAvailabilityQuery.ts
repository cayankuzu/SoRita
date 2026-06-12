import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/mobile/app/data/query/queryKeys';
import { checkAccountAvailability } from '@/mobile/app/data/repositories/accountAvailability';

const AVAILABILITY_STALE_TIME_MS = 1000 * 60;

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
  if (!enabled) {
    return { status: 'idle' };
  }

  if (isFetching) {
    return {
      status: 'checking',
      message: messages.checkingMessage,
    };
  }

  if (isError || isAvailable == null) {
    return {
      status: 'error',
      message: messages.errorMessage,
    };
  }

  return {
    status: isAvailable ? 'available' : 'unavailable',
    message: isAvailable ? messages.availableMessage : messages.unavailableMessage,
  };
}

export function useUsernameAvailabilityQuery({
  active,
  availableMessage,
  checkingMessage,
  errorMessage,
  excludeUserId,
  invalidMessage,
  unavailableMessage,
  value,
}: UsernameAvailabilityQueryParams) {
  const normalizedValue = value.trim().toLowerCase();
  const invalid = normalizedValue ? invalidMessage?.(normalizedValue) ?? null : null;
  const enabled = active && Boolean(normalizedValue) && !invalid;
  const query = useQuery({
    queryKey: queryKeys.accountAvailability.username(normalizedValue, excludeUserId),
    queryFn: async () => {
      const result = await checkAccountAvailability({
        username: normalizedValue,
        excludeUserId,
      });
      return result.usernameAvailable;
    },
    enabled,
    staleTime: AVAILABILITY_STALE_TIME_MS,
  });

  const availability = useMemo<AvailabilityState>(() => {
    if (!normalizedValue) {
      return { status: 'idle' };
    }

    if (invalid) {
      return {
        status: 'invalid',
        message: invalid,
      };
    }

    return buildAvailabilityState(
      enabled,
      query.isFetching,
      query.isError,
      query.data,
      {
        availableMessage,
        checkingMessage,
        errorMessage,
        unavailableMessage,
      },
    );
  }, [
    availableMessage,
    checkingMessage,
    enabled,
    errorMessage,
    invalid,
    normalizedValue,
    query.data,
    query.isError,
    query.isFetching,
    unavailableMessage,
  ]);

  return {
    availability,
    normalizedValue,
    query,
  };
}

export function useEmailAvailabilityQuery({
  active,
  availableMessage,
  checkingMessage,
  errorMessage,
  invalidMessage,
  unavailableMessage,
  value,
}: AvailabilityQueryParams) {
  const normalizedValue = value.trim().toLowerCase();
  const invalid = normalizedValue ? invalidMessage?.(normalizedValue) ?? null : null;
  const enabled = active && Boolean(normalizedValue) && !invalid;
  const query = useQuery({
    queryKey: queryKeys.accountAvailability.email(normalizedValue),
    queryFn: async () => {
      const result = await checkAccountAvailability({ email: normalizedValue });
      return result.emailAvailable;
    },
    enabled,
    staleTime: AVAILABILITY_STALE_TIME_MS,
  });

  const availability = useMemo<AvailabilityState>(() => {
    if (!normalizedValue) {
      return { status: 'idle' };
    }

    if (invalid) {
      return {
        status: 'invalid',
        message: invalid,
      };
    }

    return buildAvailabilityState(
      enabled,
      query.isFetching,
      query.isError,
      query.data,
      {
        availableMessage,
        checkingMessage,
        errorMessage,
        unavailableMessage,
      },
    );
  }, [
    availableMessage,
    checkingMessage,
    enabled,
    errorMessage,
    invalid,
    normalizedValue,
    query.data,
    query.isError,
    query.isFetching,
    unavailableMessage,
  ]);

  return {
    availability,
    normalizedValue,
    query,
  };
}
