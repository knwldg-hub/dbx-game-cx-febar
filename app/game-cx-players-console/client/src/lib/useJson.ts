import { useEffect, useState } from 'react';

interface JsonState<T> {
  key: string;
  url: string;
  data: T | null;
  error: string | null;
}

/**
 * Fetch JSON from an app-server route. Loading is derived (no synchronous setState in the effect).
 * Pass url = null to skip; bump reloadKey to refetch.
 * While refetching the SAME url (reloadKey bump) the previous data stays visible, so the page
 * doesn't blank out after an action; a different url (new player, new filter) starts empty.
 */
export function useJson<T>(url: string | null, reloadKey = 0) {
  const key = url ? `${url}#${reloadKey}` : '';
  const [state, setState] = useState<JsonState<T>>({ key: '', url: '', data: null, error: null });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? res.statusText);
        }
        return (await res.json()) as T;
      })
      .then((data) => {
        if (!cancelled) setState({ key, url, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ key, url, data: null, error: err instanceof Error ? err.message : 'Request failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [url, key]);

  const fresh = state.key === key;
  const sameUrl = state.url === url;
  return {
    data: fresh || sameUrl ? state.data : null,
    error: fresh ? state.error : null,
    loading: Boolean(url) && !fresh,
  };
}

export interface WhoAmI {
  email: string | null;
  user: string | null;
}
