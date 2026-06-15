"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { mobileFetchJson } from "@/lib/mobile/mobile-fetch";

interface UseLiveDataOptions<T> {
  /** URL to fetch from */
  url: string;
  /** Polling interval in ms (default: 30s) */
  interval?: number;
  /** Transform the response JSON before storing */
  transform?: (data: unknown) => T;
  /** Only poll when this is true (default: true) */
  enabled?: boolean;
  /** Dependencies — refetch when these change */
  deps?: unknown[];
}

interface UseLiveDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isStale: boolean;
}

/**
 * Custom hook for live data fetching with:
 * - Automatic polling (configurable interval)
 * - Stale-while-revalidate behavior
 * - Refetch on window focus
 * - Error resilience (keeps last good data on error)
 * - AbortController cleanup on unmount
 */
export function useLiveData<T>(options: UseLiveDataOptions<T>): UseLiveDataReturn<T> {
  const { url, interval = 30_000, transform, enabled = true, deps = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const prevDepsRef = useRef<string>("");

  // When deps change, keep stale data visible while refetching (no flash of skeleton)
  const depsKey = JSON.stringify(deps);
  useEffect(() => {
    if (prevDepsRef.current && prevDepsRef.current !== depsKey) {
      // Don't clear data — show stale-while-revalidate instead
      if (data) {
        setIsStale(true);
      } else {
        setLoading(true);
      }
      setError(null);
      lastFetchRef.current = 0;
    }
    prevDepsRef.current = depsKey;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!enabled) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible" && isBackground) return;

    // Don't refetch too quickly (debounce 2s for background)
    const now = Date.now();
    if (isBackground && now - lastFetchRef.current < 2000) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!isBackground) setLoading(true);
    if (isBackground && data) setIsStale(true);

    try {
      const response = await mobileFetchJson<unknown>(url, {
        signal: controller.signal,
        cacheKey: `live:${url}`,
        ttlMs: interval * 2,
      });
      const json = response.data;
      const result = transform ? transform(json) : json as T;

      if (isMountedRef.current) {
        setData(result);
        setError(null);
        setIsStale(response.stale);
        lastFetchRef.current = Date.now();
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Fetch failed");
        // Keep stale data on error — don't clear it
        setIsStale(data !== null);
      }
    } finally {
      if (isMountedRef.current && !isBackground) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, ...deps]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchData(false);
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [fetchData]);

  // Polling interval
  useEffect(() => {
    if (!enabled || interval <= 0) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slowNetwork = connection?.saveData || connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g";
    const mobileInterval = slowNetwork ? Math.max(interval * 4, 120_000) : interval;
    const id = setInterval(() => fetchData(true), mobileInterval);
    return () => clearInterval(id);
  }, [fetchData, interval, enabled]);

  // Refetch on window focus (with 5s cooldown)
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastFetchRef.current > 5000) {
        fetchData(true);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  return { data, loading, error, refetch, isStale };
}

/**
 * Hook for data that takes URL params. Builds URL from base + params.
 */
export function useLiveQuery<T>(
  baseUrl: string,
  params: Record<string, string>,
  options?: Partial<UseLiveDataOptions<T>>
): UseLiveDataReturn<T> {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${baseUrl}?${qs}` : baseUrl;
  return useLiveData<T>({
    url,
    interval: 30_000,
    ...options,
    deps: [qs, ...(options?.deps || [])],
  });
}
