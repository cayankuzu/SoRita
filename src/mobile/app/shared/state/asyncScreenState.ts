export type EmptyReason =
  | 'blocked'
  | 'filtered'
  | 'no-content'
  | 'no-results'
  | 'no-user-intent'
  | 'private'
  | 'unknown';

export type AsyncScreenState<TData, TSection extends string = string> =
  | { kind: 'initial-loading' }
  | { kind: 'ready'; data: TData; refreshing: boolean }
  | { kind: 'empty'; reason: EmptyReason }
  | { kind: 'partial'; data: TData; failedSections: TSection[] }
  | { kind: 'offline-cache'; data: TData; savedAt: number }
  | { kind: 'error'; error: unknown; canRetry: boolean }
  | { kind: 'not-found' };

export function resolveAsyncScreenState<TData, TSection extends string = string>(params: {
  canRetry?: boolean;
  data?: TData | null;
  emptyReason?: EmptyReason;
  error?: unknown;
  failedSections?: TSection[];
  hasLoaded: boolean;
  isEmpty?: (data: TData) => boolean;
  notFound?: boolean;
  refreshing?: boolean;
}): AsyncScreenState<TData, TSection> {
  if (!params.hasLoaded && !params.data) {
    return { kind: 'initial-loading' };
  }

  if (params.data) {
    if (params.failedSections?.length) {
      return {
        kind: 'partial',
        data: params.data,
        failedSections: params.failedSections,
      };
    }

    if (params.isEmpty?.(params.data)) {
      return {
        kind: 'empty',
        reason: params.emptyReason || 'no-content',
      };
    }

    return {
      kind: 'ready',
      data: params.data,
      refreshing: Boolean(params.refreshing),
    };
  }

  if (params.notFound && params.hasLoaded) {
    return { kind: 'not-found' };
  }

  if (params.error) {
    return {
      kind: 'error',
      error: params.error,
      canRetry: params.canRetry ?? true,
    };
  }

  return {
    kind: 'empty',
    reason: params.emptyReason || 'unknown',
  };
}
