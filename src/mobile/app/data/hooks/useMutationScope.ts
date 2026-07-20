import { useId, useMemo } from 'react';

export function useMutationScope(prefix: string) {
  const instanceId = useId();
  return useMemo(() => ({ id: `${prefix}:${instanceId}` }), [instanceId, prefix]);
}
