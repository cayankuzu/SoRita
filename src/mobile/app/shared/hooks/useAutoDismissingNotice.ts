import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A notice that clears itself after a while and never leaves its timer behind.
 *
 * The place editor had grown two hand-written copies of this - one for the
 * blocking notice, one for list selection - identical apart from how long they
 * stayed and each carrying its own ref, its own clear and its own branch of the
 * unmount cleanup. A missed branch there is a setState on an unmounted screen.
 */
export function useAutoDismissingNotice<T>(dismissAfterMs: number) {
  const [notice, setNotice] = useState<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setNotice(null);
  }, []);

  const show = useCallback(
    (next: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setNotice(next);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setNotice(null);
      }, dismissAfterMs);
    },
    [dismissAfterMs],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return { notice, show, clear };
}
