"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";

interface ActivationStatus {
  valid: boolean;
  reasonCode?: string;
  activationCode?: string;
  activatedAt?: string;
  expiresAt?: string | null;
  status?: string;
}

type ActivationState = "unknown" | "loading" | "activated" | "not_activated";

interface ActivationContextValue {
  state: ActivationState;
  status: ActivationStatus | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const ActivationContext = createContext<ActivationContextValue | undefined>(
  undefined
);

export function ActivationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActivationState>("loading");
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const init = async () => {
      try {
        const res = await fetch("/api/activation/status", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json();
        const data: ActivationStatus | null = json?.ok && json?.data ? json.data : null;

        setStatus(data);
        if (data && data.valid === true) {
          setState("activated");
        } else {
          setState("not_activated");
        }
      } catch (e: any) {
        setError(e as Error);
        setState("not_activated");
      } finally {
        setLoading(false);
      }
    };
    void init();
    return () => controller.abort();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/activation/status", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      const data: ActivationStatus | null = json?.ok && json?.data ? json.data : null;
      setStatus(data);
      if (data && data.valid === true) {
        setState("activated");
      } else {
        setState("not_activated");
      }
    } catch (e: any) {
      setError(e as Error);
      setState("not_activated");
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ state, status, loading, error, refresh }),
    [state, status, loading, error, refresh]
  );

  return (
    <ActivationContext.Provider value={value}>{children}</ActivationContext.Provider>
  );
}

export const useActivation = (): ActivationContextValue => {
  const ctx = useContext(ActivationContext);
  if (!ctx) {
    throw new Error("useActivation must be used within ActivationProvider");
  }
  return ctx;
};
