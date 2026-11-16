import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';

export interface ApiData<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  // True when the request failed because the API returned 404.
  notFound: boolean;
  // Runs the request again, e.g. from a "Try again" button.
  reload: () => void;
  // Replaces the data without refetching, e.g. with the result of a save.
  setData: (data: T) => void;
}

/**
 * Loads data from the API on mount and whenever `fetcher` changes, tracking
 * the loading and error state so the page can show a spinner, an error with a
 * retry, or the data. Pass `null` to skip the request (e.g. an invalid ID).
 * Memoize `fetcher` (`useCallback`/`useMemo`) so it only changes when its
 * inputs do.
 */
export const useApiData = <T>(
  fetcher: (() => Promise<T>) | null,
): ApiData<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(fetcher !== null);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (fetcher === null) return;

    let cancelled = false;
    // Resetting before the request; the result is set once it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    setNotFound(false);
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(true);
          setNotFound(isAxiosError(err) && err.response?.status === 404);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, loading, error, notFound, reload, setData };
};
